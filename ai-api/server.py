from flask import Flask, request, jsonify, send_file, render_template_string

import torch
import numpy as np
import os
import random
from PIL import Image
from model_utils import load_model as load_weed_model, predict_mask
from health_model_utils import load_health_model, predict_health
from canopy_utils import load_weed_model as load_canopy_model, weed_mask, extract_cover_features
from environment_utils import load_env_model, predict_env_yield
import cv2
import io

app = Flask(__name__)

# -------------------- Model Loading --------------------
device = 'cuda' if torch.cuda.is_available() else 'cpu'
print(f"Using device: {device}")

weed_model = load_weed_model('output/best_model.pth').to(device)
health_model = load_health_model('model_weights.pth', device=device)
env_model = load_env_model('yield_env_model.txt')
canopy_model = load_canopy_model('output/best_model.pth')
print("✅ Models loaded successfully.")
# -------------------------------------------------------

# -------------------- HTML Templates --------------------
home_html = """
<h2>Plant Analysis Dashboard</h2>
<ul>
  <li><a href="/weed-form">Weed Detection</a></li>
  <li><a href="/health-form">Health Classification</a></li>
  <li><a href="/yield-form">Yield Prediction</a></li>
</ul>
"""


weed_form_html = """
<h2>Weed Detection</h2>
<form action="/predict-weed" method="post" enctype="multipart/form-data">
    <input type="file" name="image" accept="image/*" required>
    <button type="submit">Detect Weeds</button>
</form>
<p><a href="/">Back to Home</a></p>
"""

health_form_html = """
<h2>Plant Health Classification</h2>
<form action="/health" method="post" enctype="multipart/form-data">
    <input type="file" name="image" accept="image/*" required>
    <button type="submit">Check Health</button>
</form>
<p><a href="/">Back to Home</a></p>
"""


yield_form_html = """
<h2>Yield Prediction</h2>
<form action="/predict-yield" method="post" enctype="multipart/form-data">
    <h3>Upload Canopy Image (optional)</h3>
    <input type="file" name="image" accept="image/*"><br><br>
    <h3>Enter Environmental Data (optional)</h3>
    <input type="number" step="0.1" name="avg_temp" placeholder="Average Temperature (°C)"><br>
    <input type="number" step="0.01" name="pesticides" placeholder="Pesticides Used (tonnes)"><br>
    <input type="number" step="0.01" name="rainfall" placeholder="Average Rainfall (mm/year)"><br><br>
    <button type="submit">Predict Yield</button>
</form>
<p><a href="/">Back to Home</a></p>
"""
# -------------------------------------------------------


@app.route('/')
def home():
    return render_template_string(home_html)


@app.route('/weed-form')
def weed_form():
    return render_template_string(weed_form_html)


@app.route('/health-form')
def health_form():
    return render_template_string(health_form_html)

@app.route('/yield-form') 
def yield_form():
    return render_template_string(yield_form_html)

@app.route('/predict-weed', methods=['POST'])
def predict_weed():
    if 'image' not in request.files:
        return jsonify({'error': "No image file provided"}), 400

    file = request.files['image']
    img = Image.open(file).convert('RGB')
    img_np = np.array(img)

    # Run segmentation
    mask = predict_mask(weed_model, img_np, device=device)

    # Calculate weed percentage
    weed_pixels = np.sum(mask > 0.5)
    total_pixels = mask.size
    weed_percentage = (weed_pixels / total_pixels) * 100

    # Create overlay
    overlay = img_np.copy()
    overlay[mask > 0.5] = (0, 255, 0)
    blended = cv2.addWeighted(img_np, 0.5, overlay, 0.5, 0)

    # Add weed percentage label
    text = f"Weed: {weed_percentage:.2f}%"
    cv2.putText(blended, text, (30, 40), cv2.FONT_HERSHEY_SIMPLEX,
                1.2, (255, 255, 255), 3, cv2.LINE_AA)

    # Convert to PNG bytes
    _, buffer = cv2.imencode('.png', cv2.cvtColor(blended, cv2.COLOR_RGB2BGR))
    io_buf = io.BytesIO(buffer)

    return send_file(io_buf, mimetype='image/png')


@app.route('/health', methods=['POST'])
def health_check():
    if 'image' not in request.files:
        return jsonify({'error': "No image file provided"}), 400

    file = request.files['image']
    img = Image.open(file).convert('RGB')

    # Predict health
    health_status = predict_health(health_model, img, device=device)

    return f"<h3>Plant Health Status: <b>{health_status}</b></h3><p><a href='/health-form'>Back</a></p>"

@app.route('/predict-yield', methods=['POST'])
def predict_yield():
    results = {}

    # Get environmental inputs
    avg_temp = float(request.form.get('avg_temp', 0) or 0)
    pesticides = float(request.form.get('pesticides', 0) or 0)
    rainfall = float(request.form.get('rainfall', 0) or 0)

    # Check if canopy image uploaded
    if 'image' in request.files and request.files['image'].filename != '':
        file = request.files['image']
        img = Image.open(file).convert('RGB')
        img_np = np.array(img)

        # Compute weed, veg, crop covers
        weed_m = weed_mask(img_np, weed_model)
        veg, weed, crop = extract_cover_features(img_np, weed_m)

        # Estimate yield from canopy data
        yield_canopy = (0.6 * crop - 0.3 * weed + 0.1 * veg)
        yield_canopy = max(0, yield_canopy) / 100 * 5  # scale to tons/ha

        results.update({
            "Vegetation Cover (%)": round(veg, 2),
            "Weed Cover (%)": round(weed, 2),
            "Crop Cover (%)": round(crop, 2),
            "Yield from Canopy (t/ha)": round(yield_canopy, 2)
        })

    # Environmental yield prediction
    if any([avg_temp, pesticides, rainfall]):
        yield_env = predict_env_yield(env_model, avg_temp, pesticides, rainfall)
        results["Yield from Environment (t/ha)"] = round(yield_env, 2)/10000

    # Combine both if available
    if "Yield from Canopy (t/ha)" in results and "Yield from Environment (t/ha)" in results:
        yield_combined = 0.6 * results["Yield from Canopy (t/ha)"] + 0.4 * results["Yield from Environment (t/ha)"]
        results["Hybrid Yield (t/ha)"] = round(yield_combined, 2)

    if not results:
        return "No inputs provided! Please upload a canopy image or enter environment data."

    # Build result HTML
    result_html = "<h2>Yield Prediction Results</h2>"
    for k, v in results.items():
        result_html += f"<p><b>{k}:</b> {v}</p>"
    result_html += "<p><a href='/yield-form'>Back</a></p>"

    return result_html


# Image folders
WEED_IMAGES_DIR = r'./CoFly-WeedDB/CoFly-WeedDB/images'
HEALTH_IMAGES_DIR = r'./PlantVillage'

def get_random_image(folder):
    files = [f for f in os.listdir(folder) if f.lower().endswith(('.png', '.jpg', '.jpeg'))]
    if not files:
        raise FileNotFoundError(f"No images found in {folder}")
    return os.path.join(folder, random.choice(files))

@app.route('/analyze', methods=['POST'])
def analyze():
    data = request.get_json(force=True)
    altitude = data.get("altitude_meters", 50)

    # -------- Random Weed / Yield Image --------
    weed_img_path = get_random_image(WEED_IMAGES_DIR)
    img_np = np.array(Image.open(weed_img_path).convert('RGB'))

    # Weed detection
    mask = predict_mask(weed_model, img_np, device=device)
    weed_pixels = np.sum(mask > 0.5)
    total_pixels = mask.size
    weed_percentage = (weed_pixels / total_pixels) * 100

    # Yield prediction
    weed_m = weed_mask(img_np, canopy_model)
    veg, weed_cover, crop = extract_cover_features(img_np, weed_m)
    yield_canopy = (0.6 * crop - 0.3 * weed_cover + 0.1 * veg)
    yield_canopy = max(0, yield_canopy) / 100 * 5  # scale tons/ha

    # Env yield (dummy random for demo)
    avg_temp, pesticides, rainfall = random.uniform(20, 35), random.uniform(0, 1), random.uniform(500, 1200)
    yield_env = predict_env_yield(env_model, avg_temp, pesticides, rainfall) / 10000
    hybrid_yield = 0.6 * yield_canopy + 0.4 * yield_env

    # -------- Infection / Health Image (only if altitude < 20m) --------
    if altitude < 20:
        health_img_path = get_random_image(HEALTH_IMAGES_DIR)
        health_img = Image.open(health_img_path).convert('RGB')
        infection_score = predict_health(health_model, health_img, device=device)
    else:
        infection_score = None

    result = {
        "weed_coverage_percent": round(weed_percentage, 2),
        "yield_canopy_t_ha": round(yield_canopy, 2),
        "yield_env_t_ha": round(yield_env, 2),
        "yieldScore": round(hybrid_yield, 2),
        "vegetation_cover_percent": round(veg, 2),
        "weedScore": round(weed_cover, 2),
        "crop_cover_percent": round(crop, 2),
        "infectionScore": infection_score
    }

    return jsonify(result)


if __name__ == '__main__':
    app.run(debug=True, host="0.0.0.0", port=5000)

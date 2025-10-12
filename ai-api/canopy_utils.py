import torch
import cv2
import numpy as np
import segmentation_models_pytorch as smp

device = 'cuda' if torch.cuda.is_available() else 'cpu'

def load_weed_model(path):
    model = smp.Unet(encoder_name='resnet34', classes=1)
    checkpoint = torch.load(path, map_location=device)
    model.load_state_dict(checkpoint['model_state'])
    model.to(device).eval()
    return model

def compute_exg(image):
    img = image.astype('float')
    R, G, B = img[:,:,0], img[:,:,1], img[:,:,2]
    exg = 2 * G - R - B
    exg = (exg - exg.min()) / (exg.max() - exg.min() + 1e-8)
    return exg

def vegetation_mask_exg(image, threshold=0.4):
    exg = compute_exg(image)
    mask = (exg > threshold).astype('uint8')
    return mask

def weed_mask(image, model):
    img_resized = cv2.resize(image, (512, 512))
    tensor = torch.tensor(img_resized / 255.).permute(2,0,1).unsqueeze(0).float().to(device)
    with torch.no_grad():
        logits = model(tensor)
        prob = torch.sigmoid(logits)[0,0].cpu().numpy()
    mask = (prob > 0.5).astype(np.uint8)
    return mask

def extract_cover_features(image, weed_mask):
    veg_mask = vegetation_mask_exg(image)
    total_px = veg_mask.size
    veg_cover = 100 * veg_mask.sum() / total_px
    weed_cover = 100 * weed_mask.sum() / total_px
    crop_cover = max(0.0, veg_cover - weed_cover)
    return veg_cover, weed_cover, crop_cover

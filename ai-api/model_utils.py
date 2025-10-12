import torch
import segmentation_models_pytorch as smp
import numpy as np
import cv2
from torchvision import transforms

# Load model function
def load_model(weights_path):
    model = smp.Unet(
        encoder_name='resnet34',
        encoder_weights=None,
        in_channels=3,
        classes=1
    )
    ckpt = torch.load(weights_path, map_location='cpu')
    model.load_state_dict(ckpt['model_state'])
    model.eval()
    return model


# Predict mask for a single image
def predict_mask(model, image_np, device='cpu'):
    transform = transforms.Compose([
        transforms.ToTensor(),
        transforms.Resize((512, 512)),
        transforms.Normalize(mean=(0.485, 0.456, 0.406),
                             std=(0.229, 0.224, 0.225))
    ])

    # Preprocess
    inp = transform(image_np).unsqueeze(0).to(device)

    with torch.no_grad():
        pred = model(inp)
        mask = torch.sigmoid(pred).squeeze().cpu().numpy()

    # Resize mask back to original size
    mask = cv2.resize(mask, (image_np.shape[1], image_np.shape[0]))
    return mask

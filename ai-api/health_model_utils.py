import torch
from torchvision import models, transforms
from PIL import Image

def load_health_model(path, device='cpu'):
    model = models.efficientnet_b0(weights='IMAGENET1K_V1')
    model.classifier[1] = torch.nn.Linear(model.classifier[1].in_features, 1)
    model.load_state_dict(torch.load(path, map_location=device))
    model.eval()
    return model

def predict_health(model, image, device='cpu'):
    transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(mean=(0.485, 0.456, 0.406),
                             std=(0.229, 0.224, 0.225))
    ])
    img_tensor = transform(image).unsqueeze(0).to(device)

    with torch.no_grad():
        output = model(img_tensor)
        pred = torch.sigmoid(output).item()

    return "Not Healthy" if pred > 0.5 else "Healthy"

import os
import io
import torch
import torch.nn as nn
from PIL import Image
from torchvision import transforms
from torchvision.models import efficientnet_b0

MODEL_PATH = os.path.join(os.path.dirname(__file__), "best_model.pth")
IMAGE_SIZE = 224
CLASS_NAMES = ["Fake", "Real"]

# Determine if CUDA is available
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# Define target image transformation
transform = transforms.Compose([
    transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    )
])

# Initialize global model variable to load lazily on first prediction to save startup time
_model = None

def get_model():
    global _model
    if _model is not None:
        return _model

    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(f"Model weight file not found at {MODEL_PATH}")

    # Set up EfficientNet-B0 classifier structure
    model = efficientnet_b0(weights=None)
    num_features = model.classifier[1].in_features
    model.classifier[1] = nn.Linear(num_features, 2)

    # Load weights with map_location matching the current device
    state_dict = torch.load(MODEL_PATH, map_location=device)
    model.load_state_dict(state_dict)
    model.to(device)
    model.eval()
    
    _model = model
    return _model

def predict_image(image_file):
    """Predicts if a currency note image is Real or Fake.
    
    Args:
        image_file: Either a file path string or a file-like object (e.g. io.BytesIO).
        
    Returns:
        dict: A dictionary containing prediction details.
    """
    model = get_model()
    
    # Open and pre-process the image
    if isinstance(image_file, bytes):
        image = Image.open(io.BytesIO(image_file)).convert("RGB")
    else:
        image = Image.open(image_file).convert("RGB")
        
    image_tensor = transform(image)
    image_tensor = image_tensor.unsqueeze(0)  # Add batch dimension
    image_tensor = image_tensor.to(device)
    
    with torch.no_grad():
        outputs = model(image_tensor)
        probabilities = torch.softmax(outputs, dim=1)
        confidence, prediction = torch.max(probabilities, 1)
        
    prediction_idx = prediction.item()
    return {
        "prediction": CLASS_NAMES[prediction_idx],
        "confidence": confidence.item() * 100,
        "real_probability": probabilities[0][1].item() * 100,
        "fake_probability": probabilities[0][0].item() * 100
    }

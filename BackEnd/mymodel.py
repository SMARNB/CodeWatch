from ultralytics import YOLO
from rich import traceback
import os

traceback.install()

def train_yolo():
    # Load the segmentation model
    model = YOLO("yolo11n-seg.pt")

    # Train
    results = model.train(
        data="NewDataset/data.yaml",  
        epochs=100,                 
        imgsz=640,                 
        batch=8,                   
        device=0                  
    )

    # The model is automatically saved at the end of training.
    # We can print the actual path from the results object.
    print(f"Training completed. Best model saved at: {results.save_dir}/weights/best.pt")

    # Validation
    print("Validating trained model...")
    model.val(data="NewDataset/data.yaml", batch=8, device=0)

if __name__ == '__main__':
    train_yolo()
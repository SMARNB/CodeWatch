from ultralytics import YOLO
from rich import traceback
traceback.install()

def train_yolo():
    model = YOLO("yolo11n.pt")
    print("yes") 

    model.train(
        data="dataset/data.yaml",  
        epochs=45,                 
        imgsz=480,                 
        batch=8,                   
        device=0                   
    )
    model.best.save(f"{model.save_dir}/weights/best.pt")

    print("Validating trained model...")
    results = model.val(data="dataset/data.yaml", batch=8, device=0)

    # print("Running inference on test.jpg...")
    # results = model.predict(source="test.jpg", conf=0.5, device=0, save=True)

    print("Training completed. Best model saved at 'runs/detect/train/weights/best.pt'")


if __name__ == '__main__':
    train_yolo()
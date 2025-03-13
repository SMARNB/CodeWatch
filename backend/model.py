import torch
from ultralytics import YOLO

def test_model():
    model = YOLO("runs/detect/train7/weights/best.pt")
    results = model.predict(source="2.mp4", conf=0.5, device=0, save=True)
    
    for result in results:
        result.show()
        result.save()
        print(result.pandas().xywh)

if __name__ == '__main__':
    test_model()

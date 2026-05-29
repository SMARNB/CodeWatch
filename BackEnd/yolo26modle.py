from ultralytics import YOLO

# Load base detection model
model = YOLO("yolo26n.pt")

# Train on the dress code dataset
model.train(
    data="path/to/data.yaml",  # from Roboflow export
    epochs=50,
    imgsz=640,
    batch=16,              # RTX 3060 12GB can handle this
    device=0,
    project="dresscode",
    name="codewatch_v1"
)
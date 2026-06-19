from ultralytics import YOLO
import os
import multiprocessing

def train():
    DATASET_PATH = r"C:\Users\alira\OneDrive\Documents\FYP\BackEnd\FYP.v5i.yolo26"
    DATA_YAML = os.path.join(DATASET_PATH, "data.yaml")

    # Fine-tune from our existing trained model (not base yolo26n.pt)
    EXISTING_MODEL = r"C:\Users\alira\OneDrive\Documents\FYP\BackEnd\runs\detect\dresscode_runs\codewatch_dresscode_v1\weights\best.pt"

    model = YOLO(EXISTING_MODEL)

    results = model.train(
        data=DATA_YAML,
        epochs=50,        # Fewer epochs needed for fine-tuning
        imgsz=640,
        batch=-1,
        device=0,
        project="dresscode_runs",
        name="codewatch_dresscode_v2",
        patience=10,
        workers=4,
        amp=True,
        exist_ok=True,
        cache=True,
        lr0=0.001,        # Lower learning rate for fine-tuning
        freeze=10         # Freeze first 10 layers — only train the head
    )

    print(f"Training complete! Best model saved at: {results.save_dir}/weights/best.pt")

if __name__ == '__main__':
    multiprocessing.freeze_support()
    train()
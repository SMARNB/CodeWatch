from ultralytics import YOLO
import os
import multiprocessing

def train():
    # SANDBOX dataset (relabeled: w-dress split into w-dress[7]=modest + w-western-dress[15]=western)
    DATASET_PATH = r"C:\Users\alira\Documents\FYP-Liveness-Dev\BackEnd\FYP.v5i.yolo26"
    DATA_YAML = os.path.join(DATASET_PATH, "data.yaml")

    # Fine-tune from the existing v2 model into v3 (v2 kept untouched for rollback)
    EXISTING_MODEL = r"C:\Users\alira\Documents\FYP-Liveness-Dev\BackEnd\runs\detect\dresscode_runs\codewatch_dresscode_v2\weights\best.pt"

    model = YOLO(EXISTING_MODEL)

    results = model.train(
        data=DATA_YAML,
        epochs=50,        # Fewer epochs needed for fine-tuning
        imgsz=640,
        batch=-1,
        device=0,
        project=r"C:\Users\alira\Documents\FYP-Liveness-Dev\BackEnd\runs\detect\dresscode_runs",
        name="codewatch_dresscode_v3",
        patience=10,
        workers=2,
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

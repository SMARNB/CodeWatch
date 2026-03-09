import os
import shutil
import random

dataset_path = "dataset/train"
train_ratio = 0.8
valid_ratio = 0.1
test_ratio = 0.1

output_dirs = ["dataset/train", "dataset/valid", "dataset/test"]
for out_dir in output_dirs:
    os.makedirs(os.path.join(out_dir, "images"), exist_ok=True)
    os.makedirs(os.path.join(out_dir, "labels"), exist_ok=True)


images = [f for f in os.listdir(os.path.join(dataset_path, "images")) if f.endswith((".jpg", ".png"))]


random.shuffle(images)


train_count = int(len(images) * train_ratio)
valid_count = int(len(images) * valid_ratio)

train_images = images[:train_count]
valid_images = images[train_count:train_count + valid_count]
test_images = images[train_count + valid_count:]

def move_files(image_list, src_dir, dest_dir):
    for img in image_list:
        shutil.move(os.path.join(src_dir, "images", img), os.path.join(dest_dir, "images", img))

        label = img.replace(".jpg", ".txt").replace(".png", ".txt")
        if os.path.exists(os.path.join(src_dir, "labels", label)):
            shutil.move(os.path.join(src_dir, "labels", label), os.path.join(dest_dir, "labels", label))


move_files(train_images, dataset_path, "dataset/train")
move_files(valid_images, dataset_path, "dataset/valid")
move_files(test_images, dataset_path, "dataset/test")

print("Dataset split complete!")

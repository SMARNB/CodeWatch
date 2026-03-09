import cv2
import numpy as np
from insightface.app import FaceAnalysis

# app = FaceAnalysis(name="antelopev2")
app = FaceAnalysis(name='buffalo_l', providers=['CUDAExecutionProvider'])
app.prepare(ctx_id=0, det_size=(640, 640))

def get_embedding(img_path):
    img = cv2.imread(img_path)
    faces = app.get(img)
    if len(faces) == 0:
        raise Exception("No face detected in: " + img_path)
    return faces[0].embedding

emb1 = get_embedding("faces/ali.png")
emb2 = get_embedding("faces/ali2.png")


final_embedding = (emb1 + emb2) / 2.0
final_embedding /= np.linalg.norm(final_embedding) 

np.save("ali.npy", final_embedding)
print("Saved final embedding.")

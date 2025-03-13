from django.shortcuts import render
from django.core.files.storage import default_storage
from  django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import os

def upload_video(request):
    if request.method == "POST" and request.FILES.get("vedio"):
        video = request.FILES["video"]
        file_name = default_storage.save(os.path.join("videos", video.name), video)
        return JsonResponse({"message": "Video uploaded", "file_path":file_name})
    
    return JsonResponse({"error": "No video uploaded"}, status=400)
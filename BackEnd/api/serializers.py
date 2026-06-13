from rest_framework import serializers
from .models import ViolationLog

class ViolationLogSerializer(serializers.ModelSerializer):
    person_name = serializers.CharField(source='person.name', read_only=True)
    
    class Meta:
        model = ViolationLog
        fields = ['id', 'person_name', 'violation_type', 'timestamp']
from rest_framework import serializers
from .models import ViolationLog, DressCodeRule

class ViolationLogSerializer(serializers.ModelSerializer):
    person_name = serializers.CharField(source='person.name', read_only=True)

    class Meta:
        model = ViolationLog
        fields = ['id', 'person_name', 'violation_type', 'timestamp']


class DressCodeRuleSerializer(serializers.ModelSerializer):
    """Admin-editable dress-code policy. `clothing_class` is fixed (it mirrors the YOLO model's
    classes) — admins edit only `status` and `gender`."""

    class Meta:
        model = DressCodeRule
        fields = ['id', 'clothing_class', 'status', 'gender', 'updated_at']
        read_only_fields = ['id', 'clothing_class', 'updated_at']
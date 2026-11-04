from rest_framework import serializers


class ResendEmailVerificationSerializer(serializers.Serializer):
    email = serializers.EmailField()
    
    def validate_email(self, value):
        return value.strip().lower()



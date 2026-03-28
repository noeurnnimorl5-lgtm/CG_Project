import insightface
from insightface.app import FaceAnalysis

try:
    print("Starting model download/initialization...")
    # This 'buffalo_l' is the set of models the system needs
    app = FaceAnalysis(name='buffalo_l', providers=['CPUExecutionProvider'])
    app.prepare(ctx_id=0, det_size=(640, 640))
    print("\n✅ SUCCESS: Models are downloaded and loaded!")
except Exception as e:
    print(f"\n❌ ERROR: {str(e)}")
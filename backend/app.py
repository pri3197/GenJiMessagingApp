import os
from flask import Flask, send_from_directory, jsonify, request
from flask_socketio import SocketIO, emit
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from dotenv import load_dotenv
from flask_cors import CORS
# Load environment variables (Supabase credentials)
load_dotenv()

app = Flask(__name__, static_folder=os.path.join(os.path.dirname(__file__), '..', 'frontend'), static_url_path='/static')
CORS(app)

# Configure SQLAlchemy with Supabase PostgreSQL URL using pg8000 driver
supabase_url = os.getenv('SUPABASE_URL')
if not supabase_url:
    raise RuntimeError('SUPABASE_URL not set in .env')
# Convert plain Postgres URL to SQLAlchemy URL with pg8000 driver
sqlalchemy_url = supabase_url.replace('postgresql://', 'postgresql+pg8000://')
app.config['SQLALCHEMY_DATABASE_URI'] = sqlalchemy_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize DB
db = SQLAlchemy(app)

class Message(db.Model):
    __tablename__ = 'messages'
    id = db.Column(db.Integer, primary_key=True)
    bluetooth_name = db.Column(db.String(64), nullable=False)
    target_name = db.Column(db.String(64), nullable=True)
    text = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    def as_dict(self):
        return {
            'id': self.id,
            'bluetoothName': self.bluetooth_name,
            'targetName': self.target_name,
            'text': self.text,
            'timestamp': self.timestamp.isoformat()
        }

# Ensure tables exist
with app.app_context():
    db.create_all()

socketio = SocketIO(app, cors_allowed_origins='*', async_mode='threading')

@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')

# Serve a dummy favicon to avoid 404 errors
@app.route('/favicon.ico')
def favicon():
    return '', 204

@socketio.on('send_message')
def handle_send_message(data):
    msg = Message(
        bluetooth_name=data.get('bluetoothName', 'Anonymous'),
        target_name=data.get('targetName'),
        text=data.get('text', ''),
        timestamp=datetime.fromisoformat(data.get('timestamp')) if data.get('timestamp') else datetime.utcnow()
    )
    db.session.add(msg)
    db.session.commit()
    emit('receive_message', msg.as_dict(), broadcast=True)

@app.route('/api/history')
def get_history():
    msgs = Message.query.order_by(Message.timestamp.desc()).limit(50).all()
    return jsonify([m.as_dict() for m in reversed(msgs)])

@app.route('/api/users')
def get_users():
    names = db.session.query(Message.bluetooth_name).distinct().all()
    return jsonify([n[0] for n in names])

@app.route('/api/health')
def health():
    return {"status": "HEALTHY"}

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, allow_unsafe_werkzeug=True)

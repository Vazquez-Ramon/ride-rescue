from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from sqlalchemy import UniqueConstraint

db = SQLAlchemy()
bcrypt = Bcrypt()

class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)

    address = db.Column(db.String(255))
    city = db.Column(db.String(100))
    zip = db.Column(db.String(20))
    phone = db.Column(db.String(20))
    profile_image = db.Column(db.String(255))  # filename in static/avatars

    vehicles = db.relationship('UserVehicle', backref='user', cascade='all, delete-orphan', lazy=True)
    appointments = db.relationship('UserAppointment', backref='user', cascade='all, delete-orphan', lazy=True)

    def set_password(self, password: str):
        self.password_hash = bcrypt.generate_password_hash(password).decode('utf-8')

    def check_password(self, password: str) -> bool:
        return bcrypt.check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'address': self.address,
            'city': self.city,
            'zip': self.zip,
            'phone': self.phone,
            'profile_image': self.profile_image
        }

class UserVehicle(db.Model):
    __tablename__ = 'user_vehicles'
    # VIN must be unique PER USER, not globally
    __table_args__ = (UniqueConstraint('user_id', 'vin', name='uq_user_vin'),)

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

    year = db.Column(db.Integer, nullable=False)
    make = db.Column(db.String(100), nullable=False)
    model = db.Column(db.String(100), nullable=False)
    engine = db.Column(db.String(100))
    vin = db.Column(db.String(17), nullable=False)  # removed global unique=True
    license = db.Column(db.String(20))
    mileage = db.Column(db.String(50))

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'year': self.year,
            'make': self.make,
            'model': self.model,
            'engine': self.engine,
            'vin': self.vin,
            'license': self.license,
            'mileage': self.mileage
        }

class UserAppointment(db.Model):
    __tablename__ = 'user_appointments'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

    customer_name = db.Column(db.String(120))
    appointment_date = db.Column(db.String(20))   # store as ISO string or text
    appointment_time = db.Column(db.String(20))   # store as HH:MM or text
    vehicle_info = db.Column(db.String(255))      # freeform "Year Make Model Engine VIN"
    services_needed = db.Column(db.Text)          # JSON string of services array
    notes = db.Column(db.Text)
    status = db.Column(db.String(50), default='Pending')
    total_cost = db.Column(db.Float)              # optional total

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'customer_name': self.customer_name,
            'appointment_date': self.appointment_date,
            'appointment_time': self.appointment_time,
            'vehicle_info': self.vehicle_info,
            'services_needed': self.services_needed,
            'notes': self.notes,
            'status': self.status,
            'total_cost': self.total_cost
        }

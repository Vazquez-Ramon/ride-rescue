from flask import render_template, request, jsonify, redirect, session, url_for
from functools import wraps
import sqlite3
import os
import json
import uuid

from app.models import db, User, UserVehicle, UserAppointment

def init_routes(app):

    BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../"))

    VEHICLES_DB_PATH = os.path.join(BASE_DIR, "vehicles.db")
    SERVICES_DB_PATH = os.path.join(BASE_DIR, "services.db")
    
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}

    # Avatars
    UPLOAD_FOLDER = os.path.join(app.static_folder, 'avatars')
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}
    app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

    # =========================
    # Helpers
    # =========================

    def allowed_file(filename):
        return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

    def get_db_connection(db_path):
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        return conn
    
    def login_required(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if 'user_id' not in session:
                wants_json = (
                    request.is_json
                    or request.accept_mimetypes.best == 'application/json'
                    or request.headers.get('X-Requested-With') == 'XMLHttpRequest'
                    or request.path.startswith('/api/')
                )
                if wants_json:
                    return jsonify({'message': 'Not authenticated'}), 401
                return redirect(url_for('login', next=request.url))
            return f(*args, **kwargs)
        return decorated_function

    # =========================
    # BASIC ROUTES
    # =========================

    @app.route('/')
    def home():
        return render_template('index.html')
    
    # =========================
    # VEHICLE DATA ROUTES
    # =========================

    @app.route('/get_years')
    def get_years():
        conn = get_db_connection(VEHICLES_DB_PATH)
        try:
            years = conn.execute("SELECT DISTINCT year FROM vehicles ORDER BY year DESC").fetchall()
            return jsonify([row['year'] for row in years])
        finally:
            conn.close()

    @app.route('/get_makes')
    def get_makes():
        year = request.args.get('year')
        if not year:
            return jsonify({"error": "Year parameter is required"}), 400
        conn = get_db_connection(VEHICLES_DB_PATH)
        try:
            makes = conn.execute("SELECT DISTINCT make FROM vehicles WHERE year=?", (year,)).fetchall()
            return jsonify([row['make'] for row in makes])
        finally:
            conn.close()

    @app.route('/get_models')
    def get_models():
        year = request.args.get('year')
        make = request.args.get('make')
        if not year or not make:
            return jsonify({"error": "Year and Make parameters are required"}), 400
        conn = get_db_connection(VEHICLES_DB_PATH)
        try:
            models = conn.execute(
                "SELECT DISTINCT model FROM vehicles WHERE year=? AND make=?",
                (year, make)
            ).fetchall()
            return jsonify([row['model'] for row in models])
        finally:
            conn.close()

    @app.route('/get_engines')
    def get_engines():
        year = request.args.get('year')
        make = request.args.get('make')
        model = request.args.get('model')
        if not year or not make or not model:
            return jsonify({"error": "Year, Make, and Model parameters are required"}), 400
        conn = get_db_connection(VEHICLES_DB_PATH)
        try:
            engines = conn.execute(
                "SELECT DISTINCT engine FROM vehicles WHERE year=? AND make=? AND model=?",
                (year, make, model)
            ).fetchall()
            return jsonify([row['engine'] for row in engines])
        finally:
            conn.close()

    @app.route('/get_categories')
    def get_categories():
        conn = get_db_connection(SERVICES_DB_PATH)
        try:
            categories = conn.execute("SELECT DISTINCT category FROM services").fetchall()
            return jsonify([row['category'] for row in categories])
        finally:
            conn.close()

    @app.route('/get_services')
    def get_services():
        category = request.args.get('category')
        if not category:
            return jsonify({"error": "Category parameter is required"}), 400
        conn = get_db_connection(SERVICES_DB_PATH)
        try:
            cur = conn.execute(
                "SELECT service_name, description, estimated_labor_hours FROM services WHERE category=?",
                (category,)
            )
            services = [
                {"name": row["service_name"], "description": row["description"], "estimated_labor_hours": row["estimated_labor_hours"]}
                for row in cur.fetchall()
            ]
            return jsonify(services)
        finally:
            conn.close()

    # =========================
    # AUTH ROUTES
    # =========================

    @app.route('/login', methods=['GET', 'POST'])
    def login():
        if request.method == 'POST':
            try:
                email = request.json.get('email')
                password = request.json.get('password')

                user = User.query.filter_by(email=email).first()

                if user and user.check_password(password):
                    session.clear()  # 🔥 security fix
                    session['user_id'] = user.id

                    return jsonify({
                        'success': True,
                        'message': 'Login successful!',
                        'redirect_url': url_for('user_dashboard')
                    })

                return jsonify({'success': False, 'message': 'Incorrect email or password.'}), 401

            except Exception as e:
                print(f"Login error: {e}")
                return jsonify({'message': 'Server error during login'}), 500

        return render_template('login.html')
    
    @app.route('/logout')
    def logout():
        session.clear()
        return redirect(url_for('login'))
    
    # =========================
    # DASHBOARD
    # =========================

    @app.route('/dashboard')
    @login_required
    def user_dashboard():
        user = User.query.get(session['user_id'])  # 👈 REQUIRED
        return render_template('dashboard.html', user=user)
    
    @app.route('/api/user_info')
    def get_user_info():
        user_id = session.get('user_id')

        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401

        user = User.query.get(user_id)

        if not user:
            return jsonify({'error': 'User not found'}), 404

        return jsonify({
            'id': user.id,
            'name': user.name,  # 👈 THIS MATCHES YOUR FRONTEND
            'email': user.email,
            'profile_image': user.profile_image or 'default_avatar.png'
        })
    
    # =========================
    # 🔥 NEW: USER API (KEY FIX)
    # =========================

    @app.route('/api/user')
    def get_user():
        user_id = session.get('user_id')

        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401

        user = User.query.get(user_id)

        if not user:
            return jsonify({'error': 'User not found'}), 404

        return jsonify({
            'id': user.id,
            'first_name': user.name,  # 👈 your model uses "name"
            'email': user.email,
            'profile_image': user.profile_image or 'default_avatar.png'
        })
    
    @app.route('/api/vehicles', methods=['GET'])
    @login_required
    def get_vehicles():
        try:
            user_id = session.get('user_id')

            # 🔒 Safety check (production ready)
            if not user_id:
                return jsonify([]), 401

            vehicles = UserVehicle.query.filter_by(user_id=user_id).all()

            # ✅ Ensure safe serialization
            result = []
            for v in vehicles:
                try:
                    result.append(v.to_dict())
                except Exception as e:
                    print(f"[ERROR] Vehicle serialization failed: {e}")

            return jsonify(result)

        except Exception as e:
            print(f"[ERROR] /api/vehicles: {e}")
            return jsonify([]), 500
        
    # =========================
    # Settings / Profile / Avatar
    # =========================

    @app.route('/settings')
    @login_required
    def settings():
        user_id = session['user_id']
        user = User.query.get(user_id)
        if user:
            return render_template('settings.html', user=user)
        return redirect(url_for('login'))

    @app.route('/api/profile', methods=['GET'])
    @login_required
    def get_user_profile():
        user_id = session['user_id']
        user = User.query.get(user_id)
        if user:
            return jsonify(user.to_dict()), 200
        return jsonify({'message': 'User not found'}), 404

    @app.route('/api/avatar', methods=['POST'])
    @login_required
    def upload_avatar():
        user_id = session['user_id']
        user = User.query.get(user_id)
        if not user:
            return jsonify({'message': 'User not found'}), 404

        if 'avatar' not in request.files:
            return jsonify({'message': 'No avatar file part'}), 400

        file = request.files['avatar']
        if file.filename == '':
            return jsonify({'message': 'No selected file'}), 400

        if file and allowed_file(file.filename):
            try:
                os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

                # Generate a new unique filename (keep only basename + lower ext)
                ext = file.filename.rsplit('.', 1)[1].lower()
                unique_filename = f"{uuid.uuid4()}.{ext}"
                filepath = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
                file.save(filepath)

                # Safely remove previous custom avatar (never delete the default)
                previous = os.path.basename(user.profile_image or '')
                if previous and previous != 'default_avatar.png':
                    old_path = os.path.join(app.config['UPLOAD_FOLDER'], previous)
                    if os.path.exists(old_path):
                        os.remove(old_path)

                user.profile_image = unique_filename
                db.session.commit()

                avatar_url = url_for('static', filename=f'avatars/{unique_filename}')
                # Include both keys to match any front-end expectation
                return jsonify({
                    'message': 'Avatar uploaded successfully',
                    'avatar_url': avatar_url,
                    'url': avatar_url,            # <-- backward-compat
                    'success': True
                }), 200

            except Exception as e:
                db.session.rollback()
                print(f"Upload avatar error: {e}")
                return jsonify({'message': f'Failed to upload avatar: {str(e)}'}), 500

        return jsonify({'message': 'File type not allowed'}), 400

    @app.route('/api/profile', methods=['PUT'])
    @login_required
    def update_user_profile():
        user_id = session['user_id']
        user = User.query.get(user_id)
        if not user:
            return jsonify({'message': 'User not found'}), 404

        data = request.get_json()
        if not data:
            return jsonify({'message': 'No data provided'}), 400

        try:
            user.name = data.get('name', user.name)
            user.email = data.get('email', user.email)
            user.address = data.get('address', user.address)
            user.city = data.get('city', user.city)
            user.zip = data.get('zip', user.zip)
            user.phone = data.get('phone', user.phone)

            if 'email' in data and data['email'] != user.email:
                existing_user = User.query.filter_by(email=data['email']).first()
                if existing_user and existing_user.id != user.id:
                    return jsonify({'message': 'Email already in use'}), 409

            db.session.commit()
            return jsonify({'message': 'Profile updated successfully', 'user': user.to_dict()}), 200
        except Exception as e:
            db.session.rollback()
            print(f"Update profile error: {e}")
            return jsonify({'message': f'Failed to update profile: {str(e)}'}), 500
        
    @app.route('/api/vehicles', methods=['POST'])
    @login_required
    def create_vehicle():
        try:
            user_id = session.get('user_id')
            data = request.get_json()

            if not data:
                return jsonify({'error': 'No data provided'}), 400

            new_vehicle = UserVehicle(
                user_id=user_id,
                year=data.get('year'),
                make=data.get('make'),
                model=data.get('model'),
                engine=data.get('engine', ''),
                vin=data.get('vin'),
                license=data.get('license', ''),
                mileage=data.get('mileage', '')
            )

            db.session.add(new_vehicle)
            db.session.commit()

            return jsonify({
                'success': True,
                'vehicle': new_vehicle.to_dict()
            }), 201

        except Exception as e:
            db.session.rollback()
            print("Vehicle error:", e)
            return jsonify({'error': 'Failed to save vehicle'}), 500
        
    @app.route('/api/vehicles/<int:id>', methods=['PUT'])
    @login_required
    def update_vehicle(id):
        try:
            user_id = session.get('user_id')
            data = request.get_json()

            vehicle = UserVehicle.query.filter_by(id=id, user_id=user_id).first()

            if not vehicle:
                return jsonify({'error': 'Vehicle not found'}), 404

            # Update fields
            vehicle.vin = data.get('vin', vehicle.vin)
            vehicle.license = data.get('license', vehicle.license)
            vehicle.mileage = data.get('mileage', vehicle.mileage)

            db.session.commit()

            return jsonify({
                'success': True,
                'vehicle': vehicle.to_dict()
            })

        except Exception as e:
            db.session.rollback()
            print("Update vehicle error:", e)
            return jsonify({'error': 'Failed to update vehicle'}), 500
        
    @app.route('/api/vehicles/<int:id>', methods=['DELETE'])
    @login_required
    def delete_vehicle(id):
        try:
            user_id = session.get('user_id')

            vehicle = UserVehicle.query.filter_by(id=id, user_id=user_id).first()

            if not vehicle:
                return jsonify({'error': 'Vehicle not found'}), 404

            db.session.delete(vehicle)
            db.session.commit()

            return jsonify({'success': True})

        except Exception as e:
            db.session.rollback()
            print("Delete vehicle error:", e)
            return jsonify({'error': 'Failed to delete vehicle'}), 500
        
    @app.route('/api/appointments', methods=['GET', 'POST'])
    @login_required
    def get_appointments():
        try:
            user_id = session.get('user_id')

            if not user_id:
                return jsonify([]), 401

            # =========================
            # GET (FETCH APPOINTMENTS)
            # =========================
            if request.method == 'GET':
                appointments = UserAppointment.query.filter_by(user_id=user_id).all()

                result = []

                for a in appointments:
                    services = []

                    if a.services_needed:
                        try:
                            services = json.loads(a.services_needed)
                        except:
                            services = [{"name": s.strip()} for s in a.services_needed.split(',') if s.strip()]

                    result.append({
                        'id': a.id,
                        'appointmentDate': a.appointment_date,
                        'appointmentTime': a.appointment_time,
                        'services': services,
                        'vehicleInfo': a.vehicle_info,
                        'status': a.status or "Pending",
                        'total': float(a.total_cost) if a.total_cost else 0.0
                    })

                return jsonify(result)

            # =========================
            # POST (CREATE APPOINTMENT)
            # =========================
            elif request.method == 'POST':
                data = request.get_json()

                if not data:
                    return jsonify({'error': 'No data provided'}), 400

                try:
                    new_appt = UserAppointment(
                        user_id=user_id,
                        customer_name=data.get('customerName'),
                        appointment_date=data.get('appointmentDate'),
                        appointment_time=data.get('appointmentTime'),
                        vehicle_info=data.get('vehicleInfo'),
                        services_needed=json.dumps(data.get('services', [])),
                        status="Pending",
                        total_cost=data.get('total', 0)
                    )

                    db.session.add(new_appt)
                    db.session.commit()

                    return jsonify({
                        'success': True,
                            'appointment': {
                            'id': new_appt.id,
                            'appointmentDate': new_appt.appointment_date,
                            'appointmentTime': new_appt.appointment_time,
                            'vehicleInfo': new_appt.vehicle_info,
                            'services': data.get('services', []),
                            'status': "Pending",
                            'total': float(new_appt.total_cost or 0)
                        }
                    }), 201

                except Exception as e:
                    db.session.rollback()
                    print(f"[ERROR] Creating appointment: {e}")
                    return jsonify({'error': 'Failed to create appointment'}), 500

        except Exception as e:
            print(f"[ERROR] /api/appointments: {e}")
            return jsonify([]), 500
        
    @app.route('/api/appointments/<int:id>', methods=['DELETE'])
    @login_required
    def delete_appointment(id):
        try:
            user_id = session.get('user_id')

            appt = UserAppointment.query.filter_by(id=id, user_id=user_id).first()

            if not appt:
                return jsonify({'error': 'Not found'}), 404

            db.session.delete(appt)
            db.session.commit()

            return jsonify({'success': True})

        except Exception as e:
            db.session.rollback()
            print("Delete error:", e)
            return jsonify({'error': 'Failed to delete'}), 500
        
    @app.route('/api/appointments/<int:id>', methods=['PUT', 'PATCH'])
    @login_required
    def update_appointment(id):
        try:
            user_id = session.get('user_id')
            data = request.get_json() or {}

            appt = UserAppointment.query.filter_by(id=id, user_id=user_id).first()

            if not appt:
                return jsonify({'success': False, 'error': 'Not found'}), 404

            if 'appointmentDate' in data:
                appt.appointment_date = data.get('appointmentDate')
            if 'appointmentTime' in data:
                appt.appointment_time = data.get('appointmentTime')
            if 'vehicleInfo' in data:
                appt.vehicle_info = data.get('vehicleInfo')
            if 'services' in data:
                services = data.get('services', [])
                if isinstance(services, str):
                    services = [{"name": s.strip()} for s in services.split(',') if s.strip()]
                appt.services_needed = json.dumps(services)
            if 'status' in data:
                appt.status = data.get('status', appt.status)

            db.session.commit()

            returned_services = []
            if appt.services_needed:
                try:
                    returned_services = json.loads(appt.services_needed)
                except Exception:
                    returned_services = [{"name": s.strip()} for s in appt.services_needed.split(',') if s.strip()]

            return jsonify({
                'success': True,
                'message': 'Appointment updated successfully.',
                'appointment': {
                    'id': appt.id,
                    'appointmentDate': appt.appointment_date,
                    'appointmentTime': appt.appointment_time,
                    'vehicleInfo': appt.vehicle_info,
                    'services': returned_services,
                    'status': appt.status or 'Pending',
                    'total': float(appt.total_cost) if appt.total_cost else 0.0
                }
            })

        except Exception as e:
            db.session.rollback()
            print("Update error:", e)
            return jsonify({'success': False, 'error': f'Failed to update: {str(e)}'}), 500

    # =========================
    # OTHER PAGES
    # =========================

    @app.route('/garage')
    @login_required
    def user_garage():
        return render_template('garage.html')
tailwind.config = {
            theme: {
                extend: {
                    fontFamily: {
                        sans: ['Inter', 'sans-serif'],
                    },
                    colors: {
                        primary: '#2563EB', // blue-600
                        accent: '#1E40AF', // blue-800
                        blue600: '#2563EB',
                        blue700: '#1D4ED8',
                        gray300: '#D1D5DB',
                        gray600: '#4B5563',
                        gray800: '#1F2937', // Custom: A darker gray for text/backgrounds
                        gray900: '#111827', // Custom: Even darker
                        white: '#FFFFFF',
                    },
                    spacing: {
                        '1': '0.25rem',
                        '2': '0.5rem',
                        '3': '0.75rem',
                        '4': '1rem',
                        '5': '1.25rem',
                        '6': '1.5rem',
                        '8': '2rem',
                        '10': '2.5rem',
                        '12': '3rem',
                        '16': '4rem',
                        '20': '5rem',
                        '24': '6rem',
                        '32': '8rem',
                        '40': '10rem',
                        '48': '12rem',
                        '56': '14rem',
                        '64': '16rem',
                    },
                }
            }
        }


// --- Toast Notification Functionality ---
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) {
        console.warn('Toast element not found. Message:', message);
        return;
    }
    toast.textContent = message;
    toast.classList.remove('bg-green-600', 'bg-red-600', 'bg-blue-600'); // Clear previous colors

    if (type === 'success') {
        toast.classList.add('bg-green-600');
    } else if (type === 'error') {
        toast.classList.add('bg-red-600');
    } else {
        toast.classList.add('bg-blue-600'); // Default to info/blue
    }

    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Custom Confirmation Modal (replaces window.confirm)
function showConfirmationModal(message) {
    return new Promise((resolve) => {
        const confirmModal = document.createElement('div');
        confirmModal.className = 'modal show'; // Using existing modal classes
        confirmModal.innerHTML = `
            <div class="modal-content">
                <h3 class="text-xl font-semibold mb-4 text-gray-800">Confirmation</h3>
                <p class="mb-6">${message}</p>
                <div class="flex justify-end space-x-4">
                    <button id="cancelConfirm" class="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors">Cancel</button>
                    <button id="confirmAction" class="px-4 py-2 rounded-md bg-red-500 text-white hover:bg-red-600 transition-colors">Confirm</button>
                </div>
            </div>
        `;
        document.body.appendChild(confirmModal);

        document.getElementById('confirmAction').addEventListener('click', () => {
            confirmModal.remove();
            resolve(true);
        });

        document.getElementById('cancelConfirm').addEventListener('click', () => {
            confirmModal.remove();
            resolve(false);
        });

        confirmModal.addEventListener('click', (e) => {
            if (e.target === confirmModal) {
                confirmModal.remove();
                resolve(false);
            }
        });
    });
}


// ==================== FETCH UTILS ====================
function fetchOptions(endpoint, params) {
    return fetch(`${endpoint}?${new URLSearchParams(params)}`).then(res => res.json());
}

// ==================== GLOBAL STATE VARIABLES ====================
// Expanded stepsOrder to include category and service for single dropdown flow
let currentStep = 0;
let selections = { year: '', make: '', model: '', engine: '', category: '', service: '' }; // Initialize all
let selectedServices = []; // This will hold selected services for the cart/invoice
let allAvailableServices = []; // Holds services for the currently selected category/vehicle

// ==================== UTILITY FUNCTIONS ====================

/**
 * Updates the dynamic area in the navbar with provided HTML, usually a dropdown.
 * Always targets 'vehicle-dynamic-area' for the single dropdown flow.
 * @param {string} html - The HTML string to inject.
 */
function updateDropdownInNavbar(html) {
    const vehicleDynamicArea = document.getElementById('vehicle-dynamic-area');
    if (vehicleDynamicArea) {
        vehicleDynamicArea.innerHTML = html;
    }
}

/**
 * Populates a dropdown with options and sets up its change handler.
 * Always populates into 'vehicle-dynamic-area' for the single dropdown flow.
 * @param {string} selectId - The ID for the select element.
 * @param {Array<string>} options - Array of option values.
 * @param {string} placeholderText - The default placeholder text for the dropdown.
 * @param {string} handlerName - The name of the function to call on change.
 */
function populateDropdown(selectId, options, placeholderText, handlerName) {
    // Ensure the dropdown is visible when populated
    const dropdownContainer = document.getElementById('vehicle-dynamic-area');
    if (dropdownContainer) {
        dropdownContainer.classList.remove('hidden'); // Assuming 'hidden' class controls visibility
    }

    const html = `
        <select id="${selectId}" onchange="${handlerName}(this)" class="block w-full px-4 text-base text-gray-900 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm">
            <option value="__go_back__">⬅️ Go Back</option>
            <option class="placeholder" value="" disabled selected>${placeholderText}</option>
            ${options.map(opt => `<option value="${opt}">${opt}</option>`).join('')}
        </select>`;
    updateDropdownInNavbar(html);
    setTimeout(() => {
        const dropdown = document.getElementById(selectId);
        if (dropdown) dropdown.scrollTop = 0;
    }, 10);
}

// ==================== UNIFIED SELECTION LOGIC (Vehicle & Service) ====================

/**
 * Handles the selection for Year, Make, Model, Engine, Category, and Service
 * within a single dropdown flow.
 * @param {HTMLSelectElement} select - The select element that triggered the event.
 */
async function handleSelection(select) {
    const selectedValue = select.value;
    const currentStepName = stepsOrder[currentStep];

    if (!selectedValue || selectedValue === '__go_back__') {
        if (currentStep > 0) {
            // Clear the current step's selection and go back to the previous step
            selections[currentStepName] = ''; // Clear current step's selection
            currentStep--;
            // Clear all subsequent selections in case user goes back in the middle
            for (let i = currentStep + 1; i < stepsOrder.length; i++) {
                selections[stepsOrder[i]] = '';
            }
            updateProgressText();
            loadNextStep(); // Load previous dropdown
        } else {
            // If at the first step (year) and go back, clear all and reset
            resetVehicleSelection();
        }
        return;
    }

    selections[currentStepName] = selectedValue;
    updateProgressText(); // Update vehicle display in top bar

    if (currentStep < stepsOrder.length - 1) {
        currentStep++;
        loadNextStep(); // Move to the next selection step
    } else {
        // All selections (Vehicle, Category, Service) are complete
        const serviceName = selections.service;
        const serviceObj = allAvailableServices.find(s => s.name === serviceName);

        if (!serviceObj) {
            showToast("Selected service not found.", 'error');
            return;
        }

        const existing = selectedServices.find(s => s.name === serviceName);
        if (existing) {
            existing.quantity = (existing.quantity || 1) + 1;
        } else {
            serviceObj.quantity = 1;
            selectedServices.push(serviceObj);
        }
        showToast(`${serviceObj.name} added to cart.`, 'success');
        recalculateCart();

        // After adding to cart, revert to category selection for potential more services
        currentStep = stepsOrder.indexOf('category'); // Go back to category selection
        loadNextStep();
    }
}


/**
 * Loads the options for the current step in the unified selection flow.
 */
async function loadNextStep() {
    const stepName = stepsOrder[currentStep];
    let options = [];
    let placeholder = `---- Select ${stepName.charAt(0).toUpperCase() + stepName.slice(1)} ----`;
    let endpoint = '';
    let params = {};

    try {
        if (stepName === 'year') {
            endpoint = `/get_years`;
        } else if (stepName === 'make') {
            endpoint = `/get_makes`;
            params = { year: selections.year };
        } else if (stepName === 'model') {
            endpoint = `/get_models`;
            params = { year: selections.year, make: selections.make };
        } else if (stepName === 'engine') {
            endpoint = `/get_engines`;
            params = { year: selections.year, make: selections.make, model: selections.model };
        } else if (stepName === 'category') {
            // When selecting category, ensure vehicle is fully selected first
            const fullVehicleSelected = ['year', 'make', 'model', 'engine'].every(s => selections[s] !== '');
            if (!fullVehicleSelected) {
                // This state should ideally not be reached if flow is correct, but as a safeguard:
                showToast("Please complete vehicle selection first.", 'error');
                resetVehicleSelection(); // Go back to start
                return;
            }
            endpoint = `/get_categories`;
            // After vehicle is selected, show "Add to Garage" and "Change Vehicle" buttons
            document.getElementById('confirm-garage-btn').style.display = 'inline-block';
            document.getElementById('change-vehicle-btn').style.display = 'inline-block';
        } else if (stepName === 'service') {
            if (!selections.category) {
                showToast("Please select a category first.", 'error');
                // Revert to category step if no category is selected
                currentStep = stepsOrder.indexOf('category');
                loadNextStep();
                return;
            }
            endpoint = `/get_services`;
            params = { category: selections.category };
            const servicesData = await fetchOptions(endpoint, params);
            allAvailableServices = servicesData; // Store all services for the selected category
            options = servicesData.map(s => s.name); // Only show service names in dropdown
            populateDropdown('service-select', options, placeholder, 'handleSelection');
            return; // Exit early as we manually populate for services
        }

        options = await fetchOptions(endpoint, params);
        if (!options || options.length === 0) {
            // If no options, it might be an invalid selection, or end of path.
            // For categories/services, if nothing found, prompt to go back.
            if (stepName === 'category' || stepName === 'service') {
                 showToast(`No ${stepName}s found for your selection. Please go back.`, 'info');
                 // Populate with an empty set, but include go back.
                 populateDropdown('unified-select', [], placeholder, 'handleSelection');
                 return;
            }
            // For vehicle selection, go back if no options for next step.
            if (currentStep > 0) {
                selections[stepsOrder[currentStep]] = ''; // Clear current
                currentStep--;
                loadNextStep();
                return;
            } else {
                showToast("No vehicle options available. Please try again later.", 'error');
                return;
            }
        }
        populateDropdown('unified-select', options, placeholder, 'handleSelection');

    } catch (error) {
        showToast(`Error fetching ${stepName}s: ${error.message}`, 'error');
        console.error(`Error fetching ${stepName}s:`, error);
        // On error, revert to previous step or reset
        if (currentStep > 0) {
            currentStep--;
            loadNextStep();
        } else {
            resetVehicleSelection();
        }
    }
}

// ==================== PROGRESS TEXT (Top Bar) ====================
function updateProgressText() {
    // Only display vehicle info in the top bar
    const vehicleParts = ['year', 'make', 'model', 'engine'];
    const completedVehicleParts = vehicleParts.filter(step => selections[step] !== '' && selections[step] !== undefined);
    const vehicleIdElement = document.getElementById('vehicle-id');

    if (vehicleIdElement) {
        if (completedVehicleParts.length === vehicleParts.length) {
            const fullVehicleString = completedVehicleParts.map(step => selections[step]).join(' ');
            vehicleIdElement.textContent = fullVehicleString;
        } else if (completedVehicleParts.length > 0) {
             vehicleIdElement.textContent = `Selected: ${completedVehicleParts.map(step => selections[step]).join(' ')}...`;
        }
         else {
            vehicleIdElement.textContent = '';
        }
    }
    localStorage.setItem('rideRescueSelections', JSON.stringify(selections));
}


function resetVehicleSelection() {
    currentStep = 0;
    selections = { year: '', make: '', model: '', engine: '', category: '', service: '' };
    selectedServices = [];
    allAvailableServices = [];

    // Clear cart display
    document.getElementById('cart-items').innerHTML = '';
    document.getElementById('subtotal').textContent = '0.00';
    document.getElementById('tax-amount').textContent = '0.00';
    document.getElementById('total-amount').textContent = '0.00';
    updateCartIcon(); // Update cart badge

    updateProgressText(); // Clear vehicle display in top bar

    // Clear and hide dynamic dropdown areas (only vehicle-dynamic-area remains)
    document.getElementById('vehicle-dynamic-area').innerHTML = '';


    // Hide "Add to Garage" and "Change Vehicle" buttons
    document.getElementById('confirm-garage-btn').style.display = 'none';
    document.getElementById('change-vehicle-btn').style.display = 'none';

    loadNextStep(); // Start the vehicle selection process over again
}


// ==================== CART ====================
function recalculateCart() {
    const laborRate = 80;
    const taxRate = 5.6;
    let subtotal = 0;
    let cartHTML = '';
    selectedServices.forEach((service, idx) => {
        const quantity = service.quantity || 1;
        const laborHours = parseFloat(service.estimated_labor_hours || 1) * quantity;
        const price = laborHours * laborRate;
        subtotal += price;
        cartHTML += `
<div class="service-item">
    <strong>${service.name}</strong><br>
    ${service.description}<br>
    <div style="margin-top: 5px;">
        <button onclick="updateQuantity(${idx}, -1)" style="font-size: 18px; padding: 3px 10px;">−</button>
        <span style="margin: 0 10px;">Qty: ${quantity}</span>
        <button onclick="updateQuantity(${idx}, 1)" style="font-size: 18px; padding: 3px 10px;">+</button>
    </div>
    <strong>Total:</strong> $${price.toFixed(2)}<br>
    <button class="remove-btn" onclick="selectedServices.splice(${idx}, 1); recalculateCart();">Remove</button>
</div><br>`;
    });
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount;
    const cartItemsElement = document.getElementById('cart-items');
    const subtotalElement = document.getElementById('subtotal');
    const taxAmountElement = document.getElementById('tax-amount');
    const totalAmountElement = document.getElementById('total-amount');

    if (cartItemsElement) cartItemsElement.innerHTML = cartHTML;
    if (subtotalElement) subtotalElement.textContent = subtotal.toFixed(2);
    if (taxAmountElement) taxAmountElement.textContent = taxAmount.toFixed(2);
    if (totalAmountElement) totalAmountElement.textContent = total.toFixed(2);
    
    updateCartIcon();
}

function updateQuantity(index, delta) {
    const s = selectedServices[index];
    s.quantity = Math.max(1, (s.quantity || 1) + delta);
    recalculateCart();
}

function proceedToBooking() {
    localStorage.setItem('rideRescueSelections', JSON.stringify(selections));
    localStorage.setItem('rideRescueCart', JSON.stringify(selectedServices));
    window.location.href = '/appointments';
}

// ==================== PDF EXPORT ====================
function downloadPDF() {
    // Check if html2pdf is loaded
    if (typeof html2pdf === 'undefined') {
        showToast("PDF generation library not loaded. Please try again later or ensure internet connection.", 'error');
        console.error("html2pdf.js is not loaded.");
        return;
    }

    const invoiceNumber = Math.floor(Math.random() * 900000 + 100000);
    const today = new Date().toLocaleDateString();
    const customerName = 'John Doe'; // Placeholder - replace with actual user name
    const customerEmail = 'johndoe@email.com'; // Placeholder - replace with actual user email
    const liabilityText = 'RideRescue is not liable for any damages incurred during or after the provided service. Please review your invoice and service terms carefully.';
    const logoURL = `${window.location.origin}/static/logo.png`;

    // Retrieve totals from the displayed elements to ensure consistency
    const subtotalDisplay = document.getElementById('subtotal')?.textContent || '0.00';
    const taxAmountDisplay = document.getElementById('tax-amount')?.textContent || '0.00';
    const totalAmountDisplay = document.getElementById('total-amount')?.textContent || '0.00';


    const generateInvoiceHTML = (qrURL) => `
        <div style="font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: auto; border: 1px solid #ccc;">
            <div style="text-align: right; margin-bottom: 10px;">
                <img src="${qrURL}" alt="QR" style="height: 80px;">
            </div>
            <div style="display:flex; justify-content: space-between; align-items: center;">
                <h1 style="margin: 0;">Service Invoice</h1>
                <img src="${logoURL}" alt="Logo" style="height: 60px;">
            </div>
            <hr style="margin: 20px 0;">
            <div style="display:flex; justify-content: space-between;">
                <div>
                    <strong>Invoice #:</strong> ${invoiceNumber}<br>
                    <strong>Date:</strong> ${today}
                </div>
                <div style="text-align: right;">
                    <strong>Billed To:</strong><br>
                    ${customerName}<br>
                    ${customerEmail}
                </div>
            </div>
            <div style="margin: 20px 0;">
                <strong>Vehicle:</strong> ${selections.year || ''} ${selections.make || ''} ${selections.model || ''} ${selections.engine || ''}
            </div>
            <table style="width:100%; border-collapse: collapse;">
                <thead>
                    <tr>
                        <th style="border:1px solid #ccc; padding: 8px; background:#f0f0f0;">Service</th>
                        <th style="border:1px solid #ccc; padding: 8px; background:#f0f0f0;">Description</th>
                        <th style="border:1px solid #ccc; padding: 8px; background:#f0f0f0;">Qty</th>
                        <th style="border:1px solid #ccc; padding: 8px; background:#f0f0f0;">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${selectedServices.map(s => {
                        const qty = s.quantity || 1;
                        const laborRate = 80;
                        const laborHours = parseFloat(s.estimated_labor_hours || 1) * qty;
                        const price = laborHours * laborRate;
                        return `
                        <tr>
                            <td style="border:1px solid #ccc; padding: 8px;">${s.name}</td>
                            <td style="border:1px solid #ccc; padding: 8px;">${s.description}</td>
                            <td style="border:1px solid #ccc; padding: 8px; text-align: center;">${qty}</td>
                            <td style="border:1px solid #ccc; padding: 8px; text-align: right;">$${price.toFixed(2)}</td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
            <div style="margin-top: 20px; text-align: right;">
                <p><strong>Subtotal:</strong> $${subtotalDisplay}</p>
                <p><strong>Tax (5.6%):</strong> $${taxAmountDisplay}</p>
                <p><strong>Total:</strong> $${totalAmountDisplay}</p>
            </div>
            <div style="margin-top: 30px;">
                <strong>Signature:</strong>
                <div style="display: flex; justify-content: space-between; gap: 40px; align-items: center; margin-top: 5px;">
                    <div style="border-bottom: 1px solid #000; width: 250px; height: 30px;"></div>
                    <div style="display: flex; flex-direction: column; align-items: flex-start;">
                        <strong style="margin-bottom: 5px;">Date:</strong>
                        <div style="width: 150px; height: 30px;">${today}</div>
                    </div>
                </div>
                <div style="display: flex; align-items: center; margin-top: 10px;">
                    <input type="checkbox" checked disabled style="margin-right: 10px;">
                    <label style="font-size: 13px; color: #333;">Customer agrees to all terms and service policies outlined above.</label>
                </div>
            </div>
            <div style="margin: 40px 0 5px 0; text-align: center; font-size: 12px; color: #666;">✂️ Detach here for your receipt</div>
            <hr style="margin: 5px 0 20px 0; border: none; border-top: 2px dashed #888;"></hr>
            <div style="font-size: 13px; text-align: center; margin-top: 10px; color: #333;">
                🎁 Use promo code <strong>RIDE10</strong> on your next booking to get 10% off!
            </div>
            <div style="font-size: 12px; text-align: center; color: #444; margin-top: 20px;">
                <p>Need help? Contact RideRescue at <strong>support@riderescue.com</strong> or call <strong>(800) 555-1234</strong></p>
                <p>Thank you for choosing RideRescue. Safe travels!</p>
            </div>
            <p style="font-size: 12px; color: #666; margin-top: 30px;">${liabilityText}</p>
        </div>`;

    const opt = {
        margin: 0.5,
        filename: `RideRescue_Invoice_${invoiceNumber}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    };

    fetch(`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=https://riderescue.com/invoice/${invoiceNumber}`)
        .then(res => res.blob())
        .then(blob => new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(blob); }))
        .then(qrDataURL => {
            const invoiceHTML = generateInvoiceHTML(qrDataURL);
            html2pdf().from(invoiceHTML).set(opt).save();
        })
        .catch(error => {
            console.error("Error generating QR code or PDF:", error);
            showToast("Failed to generate PDF. Please try again.", 'error');
        });
    }

// ==================== 🚗 GARAGE (General Site-wide Functions) ====================

function selectVehicle(vehicleStr) {
    sessionStorage.setItem('selectedVehicle', vehicleStr);
    localStorage.setItem('selectedVehicle', vehicleStr);
    updateTopbarVehicle(); // Update the displayed vehicle in the top bar
}

function updateTopbarVehicle() {
    const vehicleDisplayElement = document.getElementById('vehicle-id');
    const confirmBtn = document.getElementById('confirm-garage-btn'); // "Add to Garage"
    const changeBtn = document.getElementById('change-vehicle-btn'); // "Remove Vehicle" (or "Change Vehicle")

    const currentVehicle = sessionStorage.getItem('selectedVehicle') || localStorage.getItem('selectedVehicle');
    // Determine if all vehicle selection steps are complete (Year, Make, Model, Engine)
    const allVehicleSelectionsMade = ['year', 'make', 'model', 'engine'].every(step => selections[step] !== '' && selections[step] !== undefined);


    if (vehicleDisplayElement) {
        // Display the full vehicle string only if all parts are selected
        if (allVehicleSelectionsMade) {
            vehicleDisplayElement.textContent = ` ${selections.year} ${selections.make} ${selections.model} ${selections.engine}`;
        } else {
             // If not all vehicle selections are made, display current progress or empty
            const currentVehicleProgress = ['year', 'make', 'model', 'engine']
                .filter(step => selections[step] !== '' && selections[step] !== undefined)
                .map(step => selections[step])
                .join(' ');
            vehicleDisplayElement.textContent = currentVehicleProgress ? ` ${currentVehicleProgress}` : '';
        }
    }

    // Only show "Add to Garage" and "Change Vehicle" buttons if full vehicle is selected
    if (allVehicleSelectionsMade) {
        if (confirmBtn) confirmBtn.style.display = 'inline-block';
        if (changeBtn) changeBtn.style.display = 'inline-block';
    } else {
        if (confirmBtn) confirmBtn.style.display = 'none';
        if (changeBtn) changeBtn.style.display = 'none';
    }
}

function addToGarage() {
    // Construct vehicle string from current selections
    const vehicle = `${selections.year} ${selections.make} ${selections.model} ${selections.engine}`;
    if (!vehicle || vehicle.trim() === '') {
        showToast("Please select a complete vehicle before adding to garage.", 'error');
        return;
    }

    const garage = JSON.parse(localStorage.getItem('garage') || '[]');
    if (!garage.includes(vehicle)) {
        garage.push(vehicle);
        localStorage.setItem('garage', JSON.stringify(garage));
        showToast(`${vehicle} added to your garage.`, 'success');
    } else {
        showToast(`${vehicle} is already in your garage.`, 'info');
    }

    // Hide confirm button after adding to garage, as it's now saved
    const confirmBtn = document.getElementById('confirm-garage-btn');
    if (confirmBtn) confirmBtn.style.display = 'none';
}


function changeVehicle() {
    localStorage.removeItem('selectedVehicle'); // Clear sessionStorage only for previous single vehicle string
    sessionStorage.removeItem('selectedVehicle'); // Clear sessionStorage only for previous single vehicle string
    resetVehicleSelection();
}

function toggleCartVisibility() {
    const cart = document.getElementById('cart-summary');
    const blurOverlay = document.getElementById('blur-overlay');
    const cartSound = document.getElementById('cart-sound');

    if (!cart || !blurOverlay) {
        console.error('Cart or blur overlay element not found.');
        return;
    }

    const isOpen = cart.classList.contains('open');

    if (!isOpen && selectedServices.length === 0) {
        showToast("Your cart is empty. Please add services to proceed.", 'info');
        return;
    }

    if (isOpen) {
        cart.classList.remove('open');
        document.body.classList.remove('overflow-hidden');
        blurOverlay.classList.remove('active');
    } else {
        cart.classList.add('open');
        document.body.classList.add('overflow-hidden');
        blurOverlay.classList.add('active');
        if (cartSound) {
            cartSound.play();
        }
    }
}


// ==================== USER DASHBOARD (General Site-wide Functions) ====================
function toggleUserDashboard() {
    const dash = document.getElementById('user-dashboard');
    if (!dash) return;
    const isOpen = dash.style.display === 'block';
    if (isOpen) {
        dash.style.opacity = '0';
        dash.style.transform = 'translateY(-10px)';
        setTimeout(() => { dash.style.display = 'none'; }, 200);
    } else {
        updateUserDashboard();
        dash.style.display = 'block';
        setTimeout(() => {
            dash.style.opacity = '1';
            dash.style.transform = 'translateY(0)';
        }, 10);
    }
}

function updateGarageDisplay() {
    const garage = JSON.parse(localStorage.getItem('garage') || '[]');
    const garageList = document.getElementById('garage-vehicles-list');
    if (garageList) {
        if (garage.length > 0) {
            garageList.innerHTML = garage.map(vehicle => `<p>${vehicle}</p>`).join('');
        } else {
            garageList.innerHTML = '<p>No vehicles added to garage yet.</p>';
        }
    }
}

function loadLoginPage() {
    fetch('/login').then(response => response.text()).then(html => {
        contentArea.innerHTML = html;
        const loginForm = document.querySelector('#login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', handleLogin);
        }
    });
}

function loadRegisterPage() {
    fetch('/register').then(response => response.text()).then(html => {
        contentArea.innerHTML = html;
        const registerForm = document.querySelector('#register-form');
        if (registerForm) {
            registerForm.addEventListener('submit', handleRegister);
        }
    });
}

function updateUserDashboard() {
    const userInfo = document.getElementById('user-info');
    const selections = JSON.parse(localStorage.getItem("rideRescueSelections") || '{}');
    const appt = JSON.parse(localStorage.getItem("rideRescueAppointment") || '{}'); // Assuming 'rideRescueAppointment' might be saved elsewhere
    let html = '';

    html += `<strong>Name:</strong> John Doe<br>`; // Placeholder
    html += `<strong>Email:</strong> johndoe@email.com<br><br>`; // Placeholder

    // Display saved vehicle from 'selections' if all vehicle parts are present
    const vehicleParts = ['year', 'make', 'model', 'engine'];
    const fullVehicleSelected = vehicleParts.every(step => selections[step] !== '' && selections[step] !== undefined);
    if (fullVehicleSelected) {
        const fullVehicleString = vehicleParts.map(step => selections[step]).join(' ');
        html += `<strong>Last Selected Vehicle:</strong><br>${fullVehicleString}<br><br>`;
    }


    if (appt.date && appt.time) {
        let vehicleDisplay = typeof appt.vehicle === "string" ? appt.vehicle :
            `${appt.vehicle.year || ''} ${appt.vehicle.make || ''} ${appt.vehicle.model || ''} ${appt.vehicle.engine || ''}`.trim();
        html += `<strong>Last Appointment:</strong><br>${appt.date} at ${appt.time}<br>🚗 ${vehicleDisplay}<br><br>`;
    }

    if (!html) html = `No saved data.`
    if (userInfo) userInfo.innerHTML = html;
}

function clearUserData() {
    localStorage.clear();
    showToast("🔄 All user data has been cleared.", 'info');
    location.reload();
}

function clearAllData() {
    showConfirmationModal("Are you sure you want to clear all saved data?").then(isConfirmed => {
        if (isConfirmed) {
            localStorage.clear();
            location.reload();
        }
    });
}

// ==================== CART ICON ====================
function updateCartIcon() {
    const count = selectedServices.reduce((total, s) => total + (s.quantity || 1), 0);
    const badge = document.getElementById('cart-count');
    if (badge) {
        if (count > 0) {
            badge.textContent = count;
            badge.style.display = 'inline-block';
            badge.classList.remove('pulse');
            void badge.offsetWidth; // Trigger reflow
            badge.classList.add('pulse');
        } else {
            badge.style.display = 'none';
        }
    }
}

// ==================== ERROR CODES RENDERING ====================
function renderCodes(data) {
    const container = document.getElementById('error-codes-container');

    if (!container) return;

    container.innerHTML = ''; // Clear previous content

    data.forEach(code => {
        const block = document.createElement('div');
        block.className = 'code-block';

        const summary = document.createElement('div');
        summary.className = 'code-summary';
        summary.innerHTML = `${code.code}: ${code.description} <span class="plus-icon">+</span>`;

        const details = document.createElement('div');
        details.className = 'code-details';
        details.innerHTML = `
            <table class="code-table">
                <tr><th>Description</th><td>${code.description}</td></tr>
                <tr><th>Causes</th><td>${code.causes}</td></tr>
                <tr><th>Fixes</th><td>${code.fixes}</td></tr>
                <tr><th>Severity</th><td>${code.severity}</td></tr>
            </table>
            <button class="book-button">Book Appointment</button>
        `;

        summary.addEventListener('click', () => {
            const isVisible = details.style.display === 'block';
            details.style.display = isVisible ? 'none' : 'block';
            summary.querySelector('.plus-icon').textContent = isVisible ? '+' : '-';
        });

        // Add event listener for "Book Appointment" button
        const bookButton = details.querySelector('.book-button');
        if (bookButton) {
            bookButton.addEventListener('click', () => {
                showAppointmentModal();
                // Optionally pre-select this service in the modal if applicable
                // This would require a way to map code to service, which is not directly available here.
                // For now, just opens the modal.
            });
        }

        block.appendChild(summary);
        block.appendChild(details);
        container.appendChild(block);
    });
}

// Function to open the appointment modal
function showAppointmentModal() {
    const appointmentModal = document.getElementById('appointmentModal');
    if (appointmentModal) {
        appointmentModal.classList.add('show');
        currentSelectedServicesForAppointment = []; // Clear previous selections
        updateTotalAndPrice(); // Reset totals
        populateVehiclesForAppointment(); // Populate vehicles
        const servicesCheckboxContainer = document.getElementById('servicesCheckboxesContainer');
        if (servicesCheckboxContainer) {
            servicesCheckboxContainer.innerHTML = '<p class="text-gray-500 col-span-full">Select a vehicle to see available services.</p>';
        }
    }
}

// Function to hide the appointment modal
function hideAppointmentModal() {
    const appointmentModal = document.getElementById('appointmentModal');
    if (appointmentModal) {
        appointmentModal.classList.remove('show');
        document.getElementById('appointmentForm').reset();
        currentSelectedServicesForAppointment = [];
        updateTotalAndPrice();
        const servicesCheckboxContainer = document.getElementById('servicesCheckboxesContainer');
        if (servicesCheckboxContainer) {
            servicesCheckboxContainer.innerHTML = '<p class="text-gray-500 col-span-full">Select a vehicle to see available services.</p>';
        }
    }
}

// Function to populate the vehicle dropdown in the appointment modal
async function populateVehiclesForAppointment() {
    const vehicleSelect = document.getElementById('vehicleSelect');
    if (!vehicleSelect) return;

    vehicleSelect.innerHTML = '<option value="">Loading vehicles...</option>';
    try {
        const response = await fetch('/api/vehicles');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const vehicles = await response.json();

        vehicleSelect.innerHTML = '<option value="">Select a vehicle</option>';
        if (vehicles.length === 0) {
            vehicleSelect.innerHTML = '<option value="">No vehicles in your garage</option>';
            showToast("No vehicles found in your garage. Please add a vehicle first.", 'info');
            return;
        }

        vehicles.forEach(vehicle => {
            const option = document.createElement('option');
            option.value = vehicle.id;
            option.textContent = `${vehicle.year} ${vehicle.make} ${vehicle.model} (${vehicle.license || vehicle.vin})`;
            option.dataset.vehicleInfo = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
            vehicleSelect.appendChild(option);
        });

        // Ensure the event listener is added only once
        vehicleSelect.removeEventListener('change', populateServiceCategoriesAndServices); // Remove previous to prevent duplicates
        vehicleSelect.addEventListener('change', populateServiceCategoriesAndServices);

    }
    catch (error) {
        console.error("Error fetching vehicles for appointment:", error);
        vehicleSelect.innerHTML = '<option value="">Failed to load vehicles</option>';
        showToast("Failed to load vehicles for appointment. Please try again.", 'error');
    }
}

// Function to populate service categories and services based on selected vehicle
async function populateServiceCategoriesAndServices() {
    const servicesCheckboxContainer = document.getElementById('servicesCheckboxesContainer');
    const vehicleSelect = document.getElementById('vehicleSelect');
    const selectedVehicleId = vehicleSelect.value;

    servicesCheckboxContainer.innerHTML = ''; // Clear previous services

    if (!selectedVehicleId) {
        servicesCheckboxContainer.innerHTML = '<p class="text-gray-500 col-span-full">Select a vehicle to see available services.</p>';
        currentSelectedServicesForAppointment = [];
        updateTotalAndPrice();
        return;
    }

    currentSelectedServicesForAppointment = []; // Reset selected services when vehicle changes
    updateTotalAndPrice(); // Reset totals immediately

    servicesCheckboxContainer.innerHTML = '<p class="text-gray-500 col-span-full">Loading services...</p>';

    try {
        const categoriesResponse = await fetch('/get_categories');
        if (!categoriesResponse.ok) {
            throw new Error(`HTTP error! status: ${categoriesResponse.status}`);
        }
        const categories = await categoriesResponse.json();
        
        servicesCheckboxContainer.innerHTML = '';

        if (categories.length === 0) {
            servicesCheckboxContainer.innerHTML = '<p class="text-gray-500 col-span-full">No service categories available.</p>';
            return;
        }

        let allServicesGrouped = {};
        for (const category of categories) {
            const servicesResponse = await fetch(`/get_services?category=${encodeURIComponent(category)}`);
            if (!servicesResponse.ok) {
                console.warn(`Could not fetch services for category: ${category}. Status: ${servicesResponse.status}`);
                continue;
            }
            const services = await servicesResponse.json();
            if (services.length > 0) {
                allServicesGrouped[category] = services;
            }
        }

        if (Object.keys(allServicesGrouped).length === 0) {
            servicesCheckboxContainer.innerHTML = '<p class="text-gray-500 col-span-full">No services found for this vehicle.</p>';
        } else {
            for (const category in allServicesGrouped) {
                const categoryHeader = document.createElement('h4');
                categoryHeader.className = 'col-span-full font-semibold text-gray-800 mt-4 mb-2';
                categoryHeader.textContent = category;
                servicesCheckboxContainer.appendChild(categoryHeader);

                allServicesGrouped[category].forEach(service => {
                    const div = document.createElement('div');
                    div.className = 'flex items-center';

                    div.innerHTML = `
                        <input type="checkbox" id="service-${service.name.replace(/\s/g, '')}" name="services" value="${service.name}"
                            data-labor-hours="${service.estimated_labor_hours}"
                            data-description="${service.description}"
                            class="h-4 w-4 text-primary border-gray-300 rounded">
                        <label for="service-${service.name.replace(/\s/g, '')}" class="ml-2 block text-sm text-gray-900">${service.name} ($${(service.estimated_labor_hours * LABOR_RATE_PER_HOUR).toFixed(2)})</label>
                    `;
                    servicesCheckboxContainer.appendChild(div);

                    const checkbox = div.querySelector('input[type="checkbox"]');
                    if (checkbox) {
                        checkbox.addEventListener('change', handleServiceCheckboxChange);
                    }
                });
            }
        }

    } catch (error) {
        console.error("Error fetching service categories or services:", error);
        servicesCheckboxContainer.innerHTML = '<p class="text-red-500 col-span-full">Failed to load services. Please try again.</p>';
        showToast("Failed to load services for the selected vehicle.", 'error');
    }
}
// Hook to open Update Profile Modal (moved from dashboard.html to be globally accessible)
function toggleUpdateProfileModal() {
    const modal = document.getElementById('update-profile-modal');
    if (modal) {
        modal.classList.toggle('hidden');
        if (!modal.classList.contains('hidden')) {
            // Fetch profile data to pre-fill the form
            fetch('/api/profile')
                .then(response => { // Make sure 'response' object is available here
                    if (!response.ok) {
                        // If response is not OK, parse error message from response body
                        return response.json().then(errorData => {
                            throw new Error(errorData.message || "Failed to load profile data.");
                        });
                    }
                    return response.json();
                })
                .then(data => {
                    if (data) { // Check if data is not null/undefined
                        document.getElementById('modal-name').value = data.name || '';
                        document.getElementById('modal-email').value = data.email || '';
                        document.getElementById('modal-address').value = data.address || '';
                        document.getElementById('modal-city').value = data.city || '';
                        document.getElementById('modal-zip').value = data.zip || '';
                        document.getElementById('modal-phone').value = data.phone || '';
                        // Checkboxes
                        document.getElementById('modal-text-optin').checked = data.text_optin || false;
                        document.getElementById('modal-billing-match').checked = data.billing_match || false;
                    } else {
                        showToast("Failed to load profile data.", 'error');
                    }
                })
                .catch(error => {
                    console.error("Error fetching profile:", error);
                    showToast(error.message || "Failed to load profile data.", 'error');
                });
        }
    }
}

// Lottie Animations for the timeline section
const lottiePlayers = document.querySelectorAll('.timeline-container lottie-player');

function playLottie(player) {
    if (player) {
        player.stop(); // Stop and reset
        player.play(); // Play from start
    }
}

function pauseLottie(player) {
    if (player && !player.paused) {
        player.stop(); // Stop and reset
    }
}

const observerOptions = {
    root: null, // Use the viewport as the root
    rootMargin: '0px',
    threshold: 0.1 // Keeping threshold at 10% visibility
};

const lottieObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
        const lottiePlayer = entry.target;
        if (entry.isIntersecting) {
            playLottie(lottiePlayer);
        } else {
            pauseLottie(lottiePlayer);
        }
    });
}, observerOptions);


// ==================== MAIN INITIALIZATION ON EVERY PAGE LOAD ====================
document.addEventListener('DOMContentLoaded', () => {
    // Attach event listeners for the "Add to Garage" and "Change Vehicle" buttons
    document.getElementById('confirm-garage-btn')?.addEventListener('click', addToGarage);
    document.getElementById('change-vehicle-btn')?.addEventListener('click', changeVehicle);

    // Load any previously saved vehicle data and update the display and buttons
    const savedSelections = localStorage.getItem("rideRescueSelections");
    if (savedSelections) {
        try {
            const parsedSelections = JSON.parse(savedSelections);
            // Ensure all steps are present in parsedSelections, even if empty
            stepsOrder.forEach(step => {
                if (parsedSelections[step] === undefined) {
                    parsedSelections[step] = '';
                }
            });
            selections = parsedSelections;

            // Determine currentStep based on the first incomplete selection
            const firstIncompleteStepIndex = stepsOrder.findIndex(step => !selections[step]);
            currentStep = firstIncompleteStepIndex === -1 ? stepsOrder.length : firstIncompleteStepIndex;


            updateProgressText(); // Update the top bar vehicle display based on loaded selections

            // If a full vehicle (year, make, model, engine) is selected, show category dropdown options
            const vehiclePartsSelected = ['year', 'make', 'model', 'engine'].every(step => selections[step] !== '' && selections[step] !== undefined);
            if (vehiclePartsSelected) {
                updateTopbarVehicle(); // Show "Add to Garage" and "Change Vehicle" buttons
                // If a full vehicle is selected, and we are not yet at the end of the steps (e.g., still need category/service)
                if (currentStep < stepsOrder.length) {
                    loadNextStep(); // Load categories or services based on saved state
                }
            } else {
                // If not all vehicle selections are complete, continue the vehicle selection flow from currentStep
                loadNextStep();
            }

        } catch (e) {
            console.error("Error parsing saved selections:", e);
            resetVehicleSelection(); // Reset if saved data is corrupt
        }
    } else {
        resetVehicleSelection(); // If no saved vehicle, start fresh
    }

    // Re-calculate cart on load (e.g., if services were previously added)
    recalculateCart();

    // Existing click listener for cart overlay closure
    document.addEventListener('click', (e) => {
        const cart = document.getElementById('cart-summary');
        const icon = document.getElementById('cart-icon-wrapper');
        if (cart && icon && cart.classList.contains('open') && !cart.contains(e.target) && !icon.contains(e.target)) {
            toggleCartVisibility();
        }
    });

    // Existing error codes loading (keep as is)
    fetch('/static/full_codes.json')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            renderCodes(data);
        })
        .catch(error => {
            console.error('Error loading JSON:', error);
        });

    // Handle appointment modal buttons and form submission
    const appointmentForm = document.getElementById('appointmentForm');
    const quickBookAppointmentBtn = document.getElementById('quick-book-appointment-btn');
    const closeAppointmentModalBtn = document.getElementById('closeAppointmentModal');
    const appointmentModal = document.getElementById('appointmentModal');

    if (quickBookAppointmentBtn) {
        quickBookAppointmentBtn.addEventListener('click', showAppointmentModal);
    }

    if (closeAppointmentModalBtn) {
        closeAppointmentModalBtn.addEventListener('click', hideAppointmentModal);
    }

    if (appointmentModal) {
        window.addEventListener('click', function(event) {
            if (event.target === appointmentModal) {
                hideAppointmentModal();
            }
        });
    }

    // Handle form submission
    if (appointmentForm) {
        appointmentForm.addEventListener('submit', async function (event) {
            event.preventDefault();

            const vehicleSelect = document.getElementById('vehicleSelect');
            const selectedVehicleOption = vehicleSelect.options[vehicleSelect.selectedIndex];
            const vehicleId = selectedVehicleOption ? selectedVehicleOption.value : null;
            const vehicleInfoDisplay = selectedVehicleOption ? selectedVehicleOption.dataset.vehicleInfo : 'N/A';

            if (!vehicleId || vehicleId === "") { // Check for empty value as well
                showToast("Please select a vehicle.", 'error');
                return;
            }
            if (currentSelectedServicesForAppointment.length === 0) {
                showToast("Please select at least one service.", 'error');
                return;
            }

            const formData = new FormData(appointmentForm);
            const appointmentData = {
                customerName: "Current User", // Placeholder - ideally fetched from user session
                vehicle_id: vehicleId,
                vehicleInfo: vehicleInfoDisplay,
                services: currentSelectedServicesForAppointment.map(s => ({ name: s.name, description: s.description, estimated_labor_hours: s.estimated_labor_hours, quantity: s.quantity })),
                appointmentDate: formData.get('appointmentDate'),
                appointmentTime: formData.get('appointmentTime'),
                notes: formData.get('notes'),
                generate_pdf: formData.get('generatePdf') === 'on'
            };

            try {
                const response = await fetch('/api/appointments', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(appointmentData)
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
                }

                const result = await response.json();
                showToast("Appointment booked successfully!", 'success');
                hideAppointmentModal();
                // Call fetchAndDisplayAppointments from dashboard.html to refresh the list
                if (typeof fetchAndDisplayAppointments === 'function') {
                    fetchAndDisplayAppointments();
                }
                // Call initDashboard from dashboard.html to update quick stats
                if (typeof initDashboard === 'function') {
                    initDashboard();
                }

                if (appointmentData.generate_pdf) {
                    showToast("PDF generation not fully implemented for new bookings yet.", 'info');
                    // You would call a PDF generation logic here if fully implemented
                }

            } catch (error) {
                console.error("Error booking appointment:", error);
                showToast(`Failed to book appointment: ${error.message}`, 'error');
            }
        });
    }

    // Pre-fill data from existing profile if available (from previous script)
    const modalProfileForm = document.getElementById('modalProfileForm');
    if (modalProfileForm) {
        modalProfileForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            const formData = new FormData(this);
            const data = Object.fromEntries(formData.entries());

            try {
                const response = await fetch('/api/profile', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                const result = await response.json();
                if (response.ok) {
                    showToast(result.message, 'success');
                    document.getElementById('update-profile-modal').classList.add('hidden');
                } else {
                    showToast(result.message, 'error');
                }
            } catch (err) {
                console.error(err);
                showToast('Failed to update profile.', 'error');
            }
        });
    }

    // Existing DOMContentLoaded logic from the original file (kept for other functionalities)
    updateGarageDisplay();

    const goToGarageBtn = document.getElementById('go-to-garage-btn');
    if (goToGarageBtn) {
        goToGarageBtn.addEventListener('click', () => {
            window.location.href = '/garage';
        });
    }

    const appointmentInfo = localStorage.getItem('lastAppointment');
    const appointmentElement = document.getElementById('last-appointment-info');
    if (appointmentElement) {
        appointmentElement.textContent = appointmentInfo || 'No previous appointment found.';
    }

    // Lottie Animations for the timeline section
    lottiePlayers.forEach(player => {
        lottieObserver.observe(player);
    });

    const returnToTopButton = document.getElementById('return-to-top');

    if (returnToTopButton) {
        window.addEventListener('scroll', function() {
            if (window.scrollY > 200) {
                returnToTopButton.classList.remove('opacity-0', 'invisible');
                returnToTopButton.classList.add('opacity-100', 'visible');
            } else {
                returnToTopButton.classList.remove('opacity-100', 'visible');
                returnToTopButton.classList.add('opacity-0', 'invisible');
            }
        });

        returnToTopButton.addEventListener('click', function(e) {
            e.preventDefault();
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }

    const topbarAvatar = document.getElementById('topbar-avatar');
    const avatarInput = document.getElementById('avatar-input');

    if (topbarAvatar && avatarInput) {
        topbarAvatar.addEventListener('click', function() {
            avatarInput.click();
        });

        avatarInput.addEventListener('change', function() {
            if (this.files && this.files[0]) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    topbarAvatar.src = e.target.result;
                };
                reader.readAsDataURL(this.files[0]);
            }
        });
    }
});
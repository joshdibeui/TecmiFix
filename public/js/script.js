/* ==============================
   SCRIPT GENERAL - TecmiSoluciona
   PostgreSQL + JWT Authentication
   ============================== */

// Configuration
// Use relative path to Netlify Functions - works both locally and in production
const API_BASE_URL = '/api';

// Global State
let appState = {
    user: null,
    token: null,
    imagenesBase64: [],
    todosLosTickets: []
};

// Utility Functions
const getAuthHeader = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${appState.token}`
});

const getToken = () => {
    return localStorage.getItem('authToken') || null;
};

const getUser = () => {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
};

const setAuthData = (token, user) => {
    appState.token = token;
    appState.user = user;
    if (token) localStorage.setItem('authToken', token);
    if (user) localStorage.setItem('user', JSON.stringify(user));
};

const clearAuthData = () => {
    appState.token = null;
    appState.user = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
};

// Nullify Events - Clear all form states and errors
const nullifyEvents = () => {
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
        form.reset();
        const inputs = form.querySelectorAll('input, textarea, select');
        inputs.forEach(input => {
            input.classList.remove('error');
            input.value = '';
        });
    });

    // Clear alert messages
    const alerts = document.querySelectorAll('[data-alert]');
    alerts.forEach(alert => {
        alert.innerHTML = '';
        alert.className = 'alert';
    });

    // Reset global state
    appState.imagenesBase64 = [];
    appState.todosLosTickets = [];
};

// Show Alert with Auto-hide
const showAlert = (elementId, message, type = 'error', duration = 5000) => {
    const alert = document.getElementById(elementId);
    if (!alert) return;

    alert.innerHTML = message;
    alert.className = `alert alert-${type}`;
    alert.style.display = 'block';

    if (type === 'success' && duration > 0) {
        setTimeout(() => {
            alert.innerHTML = '';
            alert.className = 'alert';
        }, duration);
    }
};

// Validate Email
const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@tecmilenio\.mx$/;
    return emailRegex.test(email);
};

document.addEventListener("DOMContentLoaded", function () {
    console.log("DOM listo");

    // Initialize auth from localStorage
    const token = getToken();
    const user = getUser();
    if (token && user) {
        setAuthData(token, user);
    }

    /* ===== REGISTRO ===== */
    const registroForm = document.getElementById("registroForm");

    if (registroForm) {
        console.log("Registro detectado en esta página");

        registroForm.addEventListener("submit", async function (e) {
            e.preventDefault();

            const nameInput = document.getElementById("name");
            const emailInput = document.getElementById("email");
            const passwordInput = document.getElementById("password");

            // Validation
            if (!nameInput?.value?.trim()) {
                showAlert('registroAlert', '❌ Por favor ingresa tu nombre', 'error');
                nameInput?.classList.add('error');
                return;
            }

            if (!emailInput?.value?.trim() || !validateEmail(emailInput.value)) {
                showAlert('registroAlert', '❌ Por favor usa tu correo institucional (@tecmilenio.mx)', 'error');
                emailInput?.classList.add('error');
                return;
            }

            if (!passwordInput?.value || passwordInput.value.length < 6) {
                showAlert('registroAlert', '❌ La contraseña debe tener al menos 6 caracteres', 'error');
                passwordInput?.classList.add('error');
                return;
            }

            const datos = {
                name: nameInput.value.trim(),
                email: emailInput.value.trim(),
                password: passwordInput.value
            };

            try {
                const respuesta = await fetch(`${API_BASE_URL}/register`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(datos)
                });

                const resultado = await respuesta.json();

                if (respuesta.ok) {
                    showAlert('registroAlert', '✅ Registro exitoso. Redirigiendo al login...', 'success', 2000);
                    setTimeout(() => {
                        window.location.href = "/login.html";
                    }, 2000);
                } else {
                    showAlert('registroAlert', `❌ ${resultado.message || 'Error en el registro'}`, 'error');
                }

            } catch (error) {
                console.error("Error registro:", error);
                showAlert('registroAlert', '❌ Error al conectar con el servidor', 'error');
            }
        });
    }

    /* ===== LOGIN ===== */
    const loginForm = document.getElementById("loginForm");

    if (loginForm) {
        console.log("Login detectado en esta página");

        loginForm.addEventListener("submit", async function (e) {
            e.preventDefault();

            const emailInput = document.getElementById("correo") || document.getElementById("email");
            const passwordInput = document.getElementById("password");

            // Validation
            if (!emailInput?.value?.trim()) {
                showAlert('loginAlert', '❌ Por favor ingresa tu correo', 'error');
                emailInput?.classList.add('error');
                return;
            }

            if (!passwordInput?.value) {
                showAlert('loginAlert', '❌ Por favor ingresa tu contraseña', 'error');
                passwordInput?.classList.add('error');
                return;
            }

            const datos = {
                email: emailInput.value.trim(),
                password: passwordInput.value
            };

            try {
                const respuesta = await fetch(`${API_BASE_URL}/login`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(datos),
                    credentials: 'include'
                });

                const resultado = await respuesta.json();

                if (respuesta.ok) {
                    setAuthData(resultado.token, resultado.user);
                    showAlert('loginAlert', '✅ Bienvenido. Redirigiendo...', 'success', 1500);
                    
                    setTimeout(() => {
                        const redirectUrl = resultado.user?.role === 'admin' ? '/admin.html' : '/dashboard.html';
                        window.location.href = redirectUrl;
                    }, 1500);
                } else {
                    showAlert('loginAlert', `❌ ${resultado.message || 'Credenciales inválidas'}`, 'error');
                    passwordInput.value = null;
                }

            } catch (error) {
                console.error("Error login:", error);
                showAlert('loginAlert', '❌ Error al conectar con el servidor', 'error');
            }
        });
    }

    /* ===== FUNCIONALIDAD DE TICKETS (PRINCIPAL.HTML) ===== */

    const ticketForm = document.getElementById("ticketForm");
    const fileInput = document.getElementById('fileInput');
    const previewGallery = document.getElementById('previewGallery');
    const imgCountBadge = document.getElementById('imgCount');

    if (fileInput && previewGallery && imgCountBadge) {
        console.log("Formulario de tickets detectado");

        fileInput.addEventListener('change', function() {
            const files = Array.from(this.files);

            previewGallery.innerHTML = '';
            appState.imagenesBase64 = [];

            if (files.length > 3) {
                showAlert('ticketAlert', '⚠️ Solo puedes subir un máximo de 3 imágenes', 'error', 3000);
                this.value = "";
                imgCountBadge.innerText = "0/3 imágenes";
                return;
            }

            imgCountBadge.innerText = `${files.length}/3 imágenes`;

            files.forEach(file => {
                if (file.type.startsWith('image/')) {
                    const reader = new FileReader();

                    reader.onload = function(e) {
                        appState.imagenesBase64.push(e.target.result);

                        const div = document.createElement('div');
                        div.classList.add('preview-item');
                        div.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
                        previewGallery.appendChild(div);
                    };

                    reader.readAsDataURL(file);
                }
            });
        });
    }

    // Submit ticket form
    if (ticketForm) {
        ticketForm.addEventListener("submit", async function(e) {
            e.preventDefault();

            const areaInput = document.getElementById("area");
            const issueTypeInput = document.getElementById("issue_type");
            const priorityInput = document.getElementById("priority");
            const descriptionInput = document.getElementById("description");

            // Validation
            if (!areaInput?.value?.trim()) {
                showAlert('ticketAlert', '❌ Por favor selecciona un área', 'error');
                return;
            }

            if (!issueTypeInput?.value?.trim()) {
                showAlert('ticketAlert', '❌ Por favor selecciona un tipo de problema', 'error');
                return;
            }

            if (!descriptionInput?.value?.trim()) {
                showAlert('ticketAlert', '❌ Por favor ingresa una descripción', 'error');
                return;
            }

            const datosTicket = {
                department: areaInput.value.trim(),
                issue_type: issueTypeInput.value.trim(),
                priority: priorityInput?.value || 'medio',
                description: descriptionInput.value.trim(),
                images: appState.imagenesBase64
            };

            try {
                const respuesta = await fetch(`${API_BASE_URL}/tickets`, {
                    method: "POST",
                    headers: getAuthHeader(),
                    body: JSON.stringify(datosTicket)
                });

                const resultado = await respuesta.json();

                if (respuesta.ok) {
                    showAlert('ticketAlert', `✅ ${resultado.message}\nFolio: ${resultado.folio}`, 'success');
                    ticketForm.reset();
                    nullifyEvents();
                    if (previewGallery) previewGallery.innerHTML = '';
                    if (imgCountBadge) imgCountBadge.innerText = "0/3 imágenes";
                } else {
                    showAlert('ticketAlert', `❌ Error: ${resultado.message}`, 'error');
                }
            } catch (error) {
                console.error("Error:", error);
                showAlert('ticketAlert', '❌ No se pudo conectar con el servidor', 'error');
            }
        });
    }

    /* ===== FUNCIONALIDAD DE ADMIN (ADMIN.HTML) ===== */

    if (window.location.pathname.includes('admin')) {
        console.log("Panel de admin detectado");
        verificarSesion();
        cargarTicketsAdmin();

        const statusFilter = document.getElementById('statusFilter');
        const priorityFilter = document.getElementById('priorityFilter');

        if (statusFilter) statusFilter.addEventListener('change', filtrarTicketsAdmin);
        if (priorityFilter) priorityFilter.addEventListener('change', filtrarTicketsAdmin);
    }

    async function cargarTicketsAdmin() {
        try {
            const respuesta = await fetch(`${API_BASE_URL}/tickets`, {
                headers: getAuthHeader()
            });

            if (respuesta.status === 401) {
                verificarSesion();
                return;
            }

            const data = await respuesta.json();

            appState.todosLosTickets = data.tickets || [];
            filtrarTicketsAdmin();

        } catch (error) {
            console.error("Error al obtener tickets:", error);
            showAlert('adminAlert', '❌ Error al cargar los tickets', 'error');
        }
    }

    function filtrarTicketsAdmin() {
        const statusFilter = document.getElementById('statusFilter')?.value || 'todos';
        const priorityFilter = document.getElementById('priorityFilter')?.value || 'todos';

        let ticketsFiltrados = appState.todosLosTickets;

        if (statusFilter !== 'todos') {
            ticketsFiltrados = ticketsFiltrados.filter(t => t.status === statusFilter);
        }

        if (priorityFilter !== 'todos') {
            ticketsFiltrados = ticketsFiltrados.filter(t => t.priority === priorityFilter);
        }

        actualizarTablaAdmin(ticketsFiltrados);
        actualizarContadoresAdmin(ticketsFiltrados);
    }

    function actualizarTablaAdmin(tickets) {
        const tableBody = document.getElementById("adminTableBody");
        if (!tableBody) return;

        tableBody.innerHTML = "";

        if (!tickets || tickets.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="9">No hay tickets que mostrar</td></tr>';
            return;
        }

        tickets.forEach(ticket => {
            const tr = document.createElement("tr");

            let statusClass = '';
            switch(ticket.status) {
                case 'abierto': statusClass = 'status-abierto'; break;
                case 'en_progreso': statusClass = 'status-progreso'; break;
                case 'cerrado': statusClass = 'status-cerrado'; break;
            }

            const priorityClass = `priority-badge priority-${ticket.priority}`;
            const userName = ticket.user?.name || ticket.user_name || 'Usuario';
            const description = ticket.description || 'Sin descripción';

            tr.innerHTML = `
                <td><strong>${ticket.folio || 'Sin folio'}</strong></td>
                <td>${userName}</td>
                <td>${ticket.department || ticket.area || 'N/A'}</td>
                <td>${ticket.issue_type || 'N/A'}</td>
                <td><span class="${priorityClass}">${ticket.priority || 'medio'}</span></td>
                <td style="max-width: 200px;">${description.substring(0, 50)}${description.length > 50 ? '...' : ''}</td>
                <td>
                    <button class="btn-img" onclick="window.verImagenesTicket(${ticket.id})">
                        🖼️ Ver (${ticket.image_count || 0})
                    </button>
                </td>
                <td>
                    <select class="status-select ${statusClass}" onchange="window.cambiarEstatusTicket(${ticket.id}, this.value)">
                        <option value="abierto" ${ticket.status === 'abierto' ? 'selected' : ''}>⏳ Abierto</option>
                        <option value="en_progreso" ${ticket.status === 'en_progreso' ? 'selected' : ''}>🔄 En Progreso</option>
                        <option value="cerrado" ${ticket.status === 'cerrado' ? 'selected' : ''}>✅ Cerrado</option>
                    </select>
                </td>
                <td>
                    <button class="btn-img" onclick="window.verDetalleTicket(${ticket.id})">
                        📋 Detalle
                    </button>
                </td>
            `;
            tableBody.appendChild(tr);
        });
    }

    function actualizarContadoresAdmin(tickets) {
        const totalCount = document.getElementById("totalCount");
        const abiertosCount = document.getElementById("abiertosCount");
        const progresoCount = document.getElementById("progresoCount");
        const cerradosCount = document.getElementById("cerradosCount");

        if (totalCount) totalCount.innerText = tickets?.length || 0;
        if (abiertosCount) abiertosCount.innerText = tickets?.filter(t => t.status === 'abierto').length || 0;
        if (progresoCount) progresoCount.innerText = tickets?.filter(t => t.status === 'en_progreso').length || 0;
        if (cerradosCount) cerradosCount.innerText = tickets?.filter(t => t.status === 'cerrado').length || 0;
    }

    /* ===== MIS TICKETS ===== */

    const verMisTicketsBtn = document.getElementById('verMisTicketsBtn');
    if (verMisTicketsBtn) {
        verMisTicketsBtn.addEventListener('click', mostrarMisTickets);
    }

    async function mostrarMisTickets() {
        try {
            const respuesta = await fetch(`${API_BASE_URL}/tickets?my=true`, {
                headers: getAuthHeader()
            });

            if (respuesta.status === 401) {
                verificarSesion();
                return;
            }

            const data = await respuesta.json();

            const ticketsList = document.getElementById('misTicketsList');
            if (!ticketsList) return;

            ticketsList.innerHTML = '';

            if (!data.tickets || data.tickets.length === 0) {
                ticketsList.innerHTML = '<p>No tienes tickets registrados.</p>';
            } else {
                data.tickets.forEach(ticket => {
                    const ticketCard = document.createElement('div');
                    ticketCard.className = 'ticket-card';

                    const fecha = new Date(ticket.created_at).toLocaleDateString();

                    ticketCard.innerHTML = `
                        <div class="ticket-header">
                            <span class="ticket-folio">📌 ${ticket.folio || 'N/A'}</span>
                            <span class="ticket-status status-${ticket.status}">${ticket.status?.replace('_', ' ') || 'N/A'}</span>
                        </div>
                        <div>
                            <span class="priority-badge priority-${ticket.priority}">${ticket.priority || 'medio'}</span>
                        </div>
                        <p><strong>Área:</strong> ${ticket.department || 'N/A'}</p>
                        <p><strong>Descripción:</strong> ${(ticket.description || 'Sin descripción').substring(0, 100)}${(ticket.description?.length || 0) > 100 ? '...' : ''}</p>
                        <p><strong>Fecha:</strong> ${fecha}</p>
                        <p><strong>Imágenes:</strong> ${ticket.image_count || 0}</p>
                    `;

                    ticketsList.appendChild(ticketCard);
                });
            }

            const modal = document.getElementById('ticketsModal');
            if (modal) modal.style.display = 'flex';

        } catch (error) {
            console.error('Error al cargar tickets:', error);
            showAlert('mainAlert', '❌ Error al cargar tus tickets', 'error');
        }
    }

    /* ===== VERIFICAR SESIÓN ===== */

    async function verificarSesion() {
        try {
            const respuesta = await fetch(`${API_BASE_URL}/verify`, {
                headers: getAuthHeader()
            });

            if (respuesta.status === 401) {
                clearAuthData();
                nullifyEvents();
                window.location.href = '/login.html';
                return;
            }

        } catch (error) {
            console.error('Error verificando sesión:', error);
            clearAuthData();
            window.location.href = '/login.html';
        }
    }

    // Verify session on page load
    if (appState.token) {
        verificarSesion();
    }
});

/* ===== FUNCIONES GLOBALES ===== */

// Logout
async function logout() {
    try {
        const token = getToken();
        if (token) {
            await fetch(`${API_BASE_URL}/logout`, {
                method: 'POST',
                headers: getAuthHeader()
            });
        }

        clearAuthData();
        nullifyEvents();
        window.location.href = '/login.html';

    } catch (error) {
        console.error('Error al cerrar sesión:', error);
        clearAuthData();
        window.location.href = '/login.html';
    }
}

// Ver imágenes de ticket
async function verImagenesTicket(ticketId) {
    try {
        const respuesta = await fetch(`${API_BASE_URL}/tickets?id=${ticketId}`, {
            headers: getAuthHeader()
        });

        const data = await respuesta.json();

        const gallery = document.getElementById("modalGallery");
        if (!gallery) return;

        const images = data.ticket?.images || data.images || [];
        if (images && images.length > 0) {
            gallery.innerHTML = images.map(img =>
                `<img src="${img.image_url}" alt="evidencia" onclick="window.open(this.src, '_blank')">`
            ).join('');
        } else {
            gallery.innerHTML = '<p>No hay imágenes para este ticket</p>';
        }

        const modal = document.getElementById("imageModal");
        if (modal) modal.style.display = "flex";

    } catch (error) {
        console.error('Error al cargar imágenes:', error);
        showAlert('mainAlert', '❌ Error al cargar las imágenes', 'error');
    }
}

// Ver detalle de ticket
async function verDetalleTicket(ticketId) {
    try {
        const respuesta = await fetch(`${API_BASE_URL}/tickets?id=${ticketId}`, {
            headers: getAuthHeader()
        });

        const data = await respuesta.json();

        const ticket = data.ticket || data;
        const updates = data.updates || [];

        const content = document.getElementById('ticketDetailContent');
        if (!content) return;

        let updatesHtml = '';
        if (updates && updates.length > 0) {
            updates.forEach(up => {
                const fecha = new Date(up.created_at).toLocaleString();
                updatesHtml += `
                    <div class="update-item">
                        <strong>${up.user?.name || up.user_name || 'Sistema'}</strong> - ${fecha}<br>
                        Estado: ${up.status || 'N/A'}<br>
                        ${up.notes ? 'Notas: ' + up.notes : ''}
                    </div>
                `;
            });
        }

        const closedDate = ticket.closed_at ? `<p><strong>Cerrado:</strong> ${new Date(ticket.closed_at).toLocaleString()}</p>` : '';

        content.innerHTML = `
            <div class="ticket-detail">
                <p><strong>Folio:</strong> ${ticket.folio || 'N/A'}</p>
                <p><strong>Usuario:</strong> ${ticket.user?.name || ticket.user_name || 'N/A'}</p>
                <p><strong>Email:</strong> ${ticket.user?.email || ticket.user_email || 'N/A'}</p>
                <p><strong>Área:</strong> ${ticket.department || ticket.area || 'N/A'}</p>
                <p><strong>Tipo:</strong> ${ticket.issue_type || 'N/A'}</p>
                <p><strong>Prioridad:</strong> ${ticket.priority || 'N/A'}</p>
                <p><strong>Estado:</strong> ${ticket.status || 'N/A'}</p>
                <p><strong>Descripción:</strong> ${ticket.description || 'N/A'}</p>
                <p><strong>Creado:</strong> ${new Date(ticket.created_at).toLocaleString()}</p>
                ${closedDate}

                <div class="update-history">
                    <h4>Historial de Actualizaciones</h4>
                    ${updatesHtml || '<p>Sin historial</p>'}
                </div>
            </div>
        `;

        const title = document.getElementById('ticketModalTitle');
        if (title) title.innerText = `Ticket: ${ticket.folio || 'N/A'}`;

        const modal = document.getElementById('ticketModal');
        if (modal) modal.style.display = "flex";

    } catch (error) {
        console.error('Error al cargar detalle:', error);
        showAlert('mainAlert', '❌ Error al cargar el detalle del ticket', 'error');
    }
}

// Cambiar estatus de ticket
async function cambiarEstatusTicket(ticketId, nuevoEstatus) {
    const notas = prompt('Agregar notas sobre este cambio (opcional):', '');

    try {
        const respuesta = await fetch(`${API_BASE_URL}/tickets-update`, {
            method: 'PUT',
            headers: getAuthHeader(),
            body: JSON.stringify({
                ticketId: ticketId,
                status: nuevoEstatus,
                notes: notas || null
            })
        });

        const resultado = await respuesta.json();

        if (respuesta.ok) {
            showAlert('adminAlert', `✅ ${resultado.message}`, 'success');
            location.reload();
        } else {
            showAlert('adminAlert', `❌ Error: ${resultado.message}`, 'error');
        }

    } catch (error) {
        console.error('Error al cambiar estatus:', error);
        showAlert('adminAlert', '❌ Error al actualizar el estatus', 'error');
    }
}

// Cerrar modal
function cerrarModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        nullifyEvents();
    }
}

// Make functions globally available
window.verImagenesTicket = verImagenesTicket;
window.verDetalleTicket = verDetalleTicket;
window.cambiarEstatusTicket = cambiarEstatusTicket;
window.logout = logout;
window.cerrarModal = cerrarModal;
window.nullifyEvents = nullifyEvents;
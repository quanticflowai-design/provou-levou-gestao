// ─── Configuração Supabase ─────────────────────────────────────────────────────
const SUPABASE_URL = 'https://jytsrxrmgvliyyuktxsd.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5dHNyeHJtZ3ZsaXl5dWt0eHNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5MDA0ODYsImV4cCI6MjA3NTQ3NjQ4Nn0.vxiQwV3DxFxfcqts4mgRjk9CRmzdhxKvKBM7XPCrKXQ';

// ─── Estado Global ─────────────────────────────────────────────────────────────
const PLAN_VALUES = {
    'Starter': 97,
    'Inicial': 197,
    'Médio': 397,
    'Premium': 797
};

let clients = [];
let db = null; // cliente Supabase (nome diferente para não conflitar com window.supabase do SDK)

// ─── Helpers de Modal ──────────────────────────────────────────────────────────
function openModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
}

function hideModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
}

// Expõe no window para compatibilidade com qualquer onclick inline remanescente
window.openRegistrationModal = () => openModal('registration-modal');
window.closeRegistrationModal = () => {
    hideModal('registration-modal');
    const form = document.getElementById('client-form');
    if (form) form.reset();
    const idInput = document.getElementById('client_id');
    if (idInput) idInput.value = '';
    const title = document.getElementById('reg-modal-title');
    if (title) title.textContent = 'Novo Cliente';
    const errorMsg = document.getElementById('form-error-message');
    if (errorMsg) errorMsg.style.display = 'none';
    const wrapper = document.getElementById('implementation-date-wrapper');
    if (wrapper) wrapper.style.display = 'none';
};
window.closeModal = () => hideModal('client-modal');
window.setFilter = (range, btn) => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
};
window.deleteClient = (id) => deleteClientById(id);
window.showClientDetails = (id) => showClientDetailsById(id);

// ─── Funções de Dados ──────────────────────────────────────────────────────────
async function loadClients() {
    if (!db) {
        updateStats();
        renderTable();
        return;
    }

    try {
        const { data, error } = await db
            .from('provou_levou_stores')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        clients = data.map(s => ({
            id: s.id,
            name: s.name,
            company: s.company || s.name,
            email: s.email,
            phone: s.phone || '',
            plan: s.plan || 'Starter',
            status: s.status || 'Ativo',
            website: s.domain || '',
            date: new Date(s.created_at).toISOString().split('T')[0],
            lastPayment: s.last_payment || '-',
            implementationDate: s.implementation_date || null
        }));
    } catch (err) {
        console.error('Erro ao carregar clientes:', err);
    }

    updateStats();
    renderTable();
}

async function addClient(event) {
    event.preventDefault();

    const errorMsg = document.getElementById('form-error-message');
    if (errorMsg) errorMsg.style.display = 'none';

    const clientId = document.getElementById('client_id') ? document.getElementById('client_id').value : '';

    const payload = {
        name: document.getElementById('name').value.trim(),
        company: document.getElementById('company').value.trim(),
        email: document.getElementById('email').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        plan: document.getElementById('plan').value,
        status: document.getElementById('status').value,
        implementation_date: document.getElementById('status').value === 'Teste Gratuito' ? document.getElementById('implementation_date').value : null,
        domain: document.getElementById('website').value.trim() || `loja-${Date.now()}.com`
    };

    if (!clientId) {
        payload.last_payment = null;
    }

    if (!db) {
        // Modo offline: salva localmente
        if (clientId) {
            const index = clients.findIndex(c => c.id == clientId);
            if (index !== -1) {
                clients[index] = { ...clients[index], ...payload, implementationDate: payload.implementation_date };
            }
        } else {
            clients.unshift({
                ...payload,
                id: Date.now(),
                date: new Date().toISOString().split('T')[0],
                lastPayment: '-',
                implementationDate: payload.implementation_date
            });
        }
        window.closeRegistrationModal();
        updateStats();
        renderTable();
        return;
    }

    try {
        if (clientId) {
            const { error } = await db.from('provou_levou_stores').update(payload).eq('id', clientId);
            if (error) throw error;
        } else {
            const { error } = await db.from('provou_levou_stores').insert([payload]);
            if (error) throw error;
        }
        window.closeRegistrationModal();
        await loadClients();
    } catch (err) {
        console.error('Erro ao cadastrar cliente:', err);
        const errorMsg = document.getElementById('form-error-message');
        if (errorMsg) {
            if (err.code === '23505') {
                errorMsg.innerHTML = `<strong>Atenção!</strong> Este domínio já está cadastrado: <strong>${payload.domain}</strong>.<br>Cada loja precisa ter um domínio único.`;
            } else {
                errorMsg.innerHTML = `Ocorreu um erro ao salvar o cliente. Verifique o console.`;
            }
            errorMsg.style.display = 'block';
        } else {
            // fallback se o elemento não existir
            if (err.code === '23505') {
                alert(`⚠️ Este domínio já está cadastrado:\n"${payload.domain}"\n\nCada loja precisa ter um domínio único. Verifique se esse cliente já existe na lista.`);
            } else {
                alert('Erro ao salvar. Verifique o console.');
            }
        }
    }
}

async function deleteClientById(id) {
    if (!confirm('Excluir este cliente?')) return;

    if (db) {
        try {
            const { error } = await db.from('provou_levou_stores').delete().eq('id', id);
            if (error) throw error;
        } catch (err) {
            console.error('Erro ao excluir:', err);
            alert('Erro ao excluir no banco!');
            return;
        }
    } else {
        clients = clients.filter(c => c.id !== id);
    }

    await loadClients();
}

function editClientById(id) {
    const c = clients.find(c => c.id == id);
    if (!c) return;

    const idInput = document.getElementById('client_id');
    if (idInput) idInput.value = c.id;

    const title = document.getElementById('reg-modal-title');
    if (title) title.textContent = 'Editar Cliente';

    document.getElementById('name').value = c.name || '';
    document.getElementById('company').value = c.company || '';
    document.getElementById('email').value = c.email || '';
    document.getElementById('phone').value = c.phone || '';
    document.getElementById('plan').value = c.plan || 'Starter';
    document.getElementById('status').value = c.status || 'Ativo';
    document.getElementById('website').value = c.website || '';

    const impWrapper = document.getElementById('implementation-date-wrapper');
    if (c.status === 'Teste Gratuito') {
        if (impWrapper) impWrapper.style.display = 'block';
        document.getElementById('implementation_date').value = c.implementationDate || c.date;
    } else {
        if (impWrapper) impWrapper.style.display = 'none';
        document.getElementById('implementation_date').value = '';
    }

    openModal('registration-modal');
}

function showClientDetailsById(id) {
    const c = clients.find(c => c.id === id);
    if (!c) return;

    document.getElementById('modal-name').textContent = c.name;
    document.getElementById('modal-company').textContent = c.company;
    document.getElementById('modal-email').textContent = c.email;
    document.getElementById('modal-phone').textContent = c.phone;
    document.getElementById('modal-plan').textContent = c.plan;
    document.getElementById('modal-date').textContent = formatDate(c.date);

    const statusBadge = document.getElementById('modal-status');
    statusBadge.textContent = c.status;
    statusBadge.className = 'status-badge ' + statusClass(c.status);

    const testDaysWrapper = document.getElementById('modal-test-days-wrapper');
    if (c.status === 'Teste Gratuito') {
        const impDate = c.implementationDate || c.date;
        const diffTime = new Date() - new Date(impDate);
        const diffDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
        const daysRemaining = Math.max(0, 7 - diffDays);
        if (diffDays > 7) {
            document.getElementById('modal-test-days').textContent = `Expirado (${diffDays} dias)`;
            document.getElementById('modal-test-days').style.color = '#ef4444'; // red
        } else {
            document.getElementById('modal-test-days').textContent = `${diffDays} de 7 dias (Restam ${daysRemaining})`;
            document.getElementById('modal-test-days').style.color = '#f59e0b'; // warning
        }
        testDaysWrapper.style.display = 'block';
    } else {
        testDaysWrapper.style.display = 'none';
    }

    const link = document.getElementById('modal-website');
    link.textContent = c.website || 'Não informado';
    link.href = c.website || '#';

    openModal('client-modal');
}

// ─── Render ────────────────────────────────────────────────────────────────────
function renderTable() {
    const tbody = document.getElementById('dashboard-client-table-body');
    if (!tbody) return;

    tbody.innerHTML = '';

    const sorted = [...clients].sort((a, b) => new Date(b.date) - new Date(a.date));

    sorted.forEach(client => {
        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';

        const cls = statusClass(client.status);
        const value = PLAN_VALUES[client.plan]
            ? `R$ ${PLAN_VALUES[client.plan].toLocaleString('pt-BR')}`
            : '-';

        let statusDisplay = client.status;
        if (client.status === 'Teste Gratuito') {
            const impDate = client.implementationDate || client.date;
            const diffTime = new Date() - new Date(impDate);
            const diffDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
            if (diffDays > 7) {
                statusDisplay = `Teste Expirado`;
            } else {
                statusDisplay = `Teste Gratuito (${diffDays}/7 dias)`;
            }
        }

        tr.innerHTML = `
            <td>
                <div style="font-weight:600">${client.name}</div>
                <div style="color:var(--text-dim);font-size:12px">${client.email}</div>
            </td>
            <td>${client.company}</td>
            <td><span style="opacity:.85">${client.plan}</span></td>
            <td style="color:var(--success);font-weight:600">${value}</td>
            <td style="color:var(--text-dim)">${client.lastPayment && client.lastPayment !== '-' ? formatDate(client.lastPayment) : '—'}</td>
            <td><span class="status-badge ${cls}">${statusDisplay}</span></td>
            <td>
                <div style="display:flex;gap:10px">
                    <button data-action="edit"   data-id="${client.id}" style="background:none;border:none;color:var(--text-dim);cursor:pointer"><i class="fas fa-edit"></i></button>
                    <button data-action="delete" data-id="${client.id}" style="background:none;border:none;color:var(--text-dim);cursor:pointer"><i class="fas fa-trash"></i></button>
                    <button data-action="view"   data-id="${client.id}" style="background:none;border:none;color:var(--text-dim);cursor:pointer"><i class="fas fa-eye"></i></button>
                </div>
            </td>
        `;

        // Clique na linha → abre detalhes (exceto em botão)
        tr.addEventListener('click', e => {
            if (!e.target.closest('button')) showClientDetailsById(client.id);
        });

        // Botões de ação via delegação
        tr.querySelectorAll('button[data-action]').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                const action = btn.dataset.action;
                const id = btn.dataset.id;
                if (action === 'edit') editClientById(id);
                if (action === 'delete') deleteClientById(id);
                if (action === 'view') showClientDetailsById(id);
            });
        });

        tbody.appendChild(tr);
    });
}

function updateStats() {
    const active = clients.filter(c => c.status === 'Ativo');
    const mrr = active.reduce((sum, c) => sum + (PLAN_VALUES[c.plan] || 0), 0);
    const growth = active.length > 0 ? '12%' : '0%';

    setText('stat-active-clients', active.length);
    setText('stat-total-mrr', `R$ ${mrr.toLocaleString('pt-BR')}`);
    setText('stat-growth', growth);

    ['Starter', 'Inicial', 'Médio', 'Premium'].forEach(plan => {
        const key = plan.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const group = clients.filter(c => c.plan === plan && c.status === 'Ativo');
        setText(`pkg-${key}-count`, group.length);
        setText(`pkg-${key}-total`, `R$ ${(group.length * (PLAN_VALUES[plan] || 0)).toLocaleString('pt-BR')}`);
    });
}

function switchView(viewId) {
    document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.toggle('active', el.dataset.view === viewId);
    });
    document.querySelectorAll('.view').forEach(el => {
        el.classList.toggle('active', el.id === viewId);
    });
    if (viewId === 'dashboard') { updateStats(); renderTable(); }
}

// ─── Utilitários ───────────────────────────────────────────────────────────────
function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function formatDate(str) {
    if (!str || str === '-') return '-';
    return new Date(str).toLocaleDateString('pt-BR', { year: 'numeric', month: 'short', day: 'numeric' });
}

function statusClass(status) {
    if (status === 'Ativo') return 'status-active';
    if (status === 'Teste Gratuito') return 'status-pending';
    return 'status-inactive';
}

// ─── Inicialização ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

    // 1. Inicializa Supabase (usando `db` para não conflitar com window.supabase do SDK CDN)
    try {
        const sdk = window.supabase; // o SDK expõe window.supabase
        if (sdk && typeof sdk.createClient === 'function') {
            db = sdk.createClient(SUPABASE_URL, SUPABASE_KEY);
            console.log('✅ Supabase conectado.');
        } else {
            console.warn('⚠️ Supabase SDK não encontrado. Modo offline.');
        }
    } catch (e) {
        console.error('❌ Falha ao inicializar Supabase:', e);
    }

    // 2. Botão "Novo Cliente"
    const btnNovoCliente = document.getElementById('btn-novo-cliente');
    if (btnNovoCliente) {
        btnNovoCliente.addEventListener('click', () => openModal('registration-modal'));
    }

    // 3. Botões de fechar modal
    const btnCloseReg = document.getElementById('btn-close-registration');
    if (btnCloseReg) btnCloseReg.addEventListener('click', window.closeRegistrationModal);

    const btnCloseClient = document.getElementById('btn-close-client');
    if (btnCloseClient) btnCloseClient.addEventListener('click', window.closeModal);

    const btnFecharDetalhes = document.getElementById('btn-fechar-detalhes');
    if (btnFecharDetalhes) btnFecharDetalhes.addEventListener('click', window.closeModal);

    // 4. Fechar modal ao clicar no overlay (fundo escuro) ou pressionar ESC
    document.addEventListener('click', e => {
        if (e.target.id === 'registration-modal') window.closeRegistrationModal();
        if (e.target.id === 'client-modal') window.closeModal();
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            const regModal = document.getElementById('registration-modal');
            const clientModal = document.getElementById('client-modal');

            if (regModal && regModal.classList.contains('active')) {
                window.closeRegistrationModal();
            }
            if (clientModal && clientModal.classList.contains('active')) {
                window.closeModal();
            }
        }
    });

    // 5. Navegação sidebar
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', e => {
            e.preventDefault();
            const viewId = item.dataset.view;
            if (viewId) switchView(viewId);
        });
    });

    // 6. Formulário de cadastro
    const form = document.getElementById('client-form');
    if (form) form.addEventListener('submit', addClient);

    // Select status de cadastro
    const statusSelect = document.getElementById('status');
    if (statusSelect) {
        statusSelect.addEventListener('change', (e) => {
            const wrapper = document.getElementById('implementation-date-wrapper');
            if (wrapper) {
                wrapper.style.display = e.target.value === 'Teste Gratuito' ? 'block' : 'none';
                if (e.target.value === 'Teste Gratuito' && !document.getElementById('implementation_date').value) {
                    document.getElementById('implementation_date').value = new Date().toISOString().split('T')[0];
                }
            }
        });
    }

    // 7. Botões de filtro (já têm onclick inline, mas garantimos via delegação também)
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    // 8. Carrega dados
    loadClients();
});

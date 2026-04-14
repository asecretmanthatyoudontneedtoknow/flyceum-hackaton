import { auth, db } from './firebase-cfg.js';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, addDoc, serverTimestamp, getDocs, query, orderBy, deleteDoc, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const loginScreen = document.getElementById('login-screen');
const adminDashboard = document.getElementById('admin-dashboard');
const IMGBB_API_KEY = '6b291b42e35b23d0bc07257ea5f34afc'; 

onAuthStateChanged(auth, (user) => {
    if (user) {
        loginScreen.classList.add('hidden');
        adminDashboard.classList.remove('hidden');
        loadReceptionMessages(); 
    } else {
        loginScreen.classList.remove('hidden');
        adminDashboard.classList.add('hidden');
    }
});

document.getElementById('login-btn').addEventListener('click', () => {
    signInWithEmailAndPassword(auth, document.getElementById('email').value, document.getElementById('password').value)
    .catch(e => alert("Ошибка входа: " + e.message));
});

document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));

// --- ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК ---
document.getElementById('tab-btn-news').addEventListener('click', () => switchTab('news'));
document.getElementById('tab-btn-reception').addEventListener('click', () => { switchTab('reception'); loadReceptionMessages(); });
document.getElementById('tab-btn-schedule').addEventListener('click', () => { switchTab('schedule'); loadScheduleSettings(); });

function switchTab(tab) {
    ['news', 'reception', 'schedule'].forEach(t => {
        document.getElementById(`tab-btn-${t}`).classList.remove('active');
        document.getElementById(`tab-${t}`).classList.add('hidden');
    });
    document.getElementById(`tab-btn-${tab}`).classList.add('active');
    document.getElementById(`tab-${tab}`).classList.remove('hidden');
}

// --- ПУБЛИКАЦИЯ НОВОСТЕЙ ---
document.getElementById('post-news-btn').addEventListener('click', async () => {
    const titleInput = document.getElementById('news-title');
    const bodyInput = document.getElementById('news-body');
    const imageInput = document.getElementById('news-image');
    const statusText = document.getElementById('upload-status');

    if (!titleInput.value || !bodyInput.value) return alert("Заполните заголовок и текст!");
    
    try {
        statusText.innerText = 'Загрузка картинки...';
        let imageUrl = "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=800&q=80";

        if (imageInput.files.length > 0) {
            const file = imageInput.files[0];
            const formData = new FormData();
            formData.append('image', file);

            const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: 'POST', body: formData });
            const data = await response.json();
            if (data.success) imageUrl = data.data.url;
            else throw new Error("Ошибка ImgBB: " + data.error.message);
        }

        statusText.innerText = 'Сохранение...';
        await addDoc(collection(db, "news"), { 
            title: titleInput.value, 
            body: bodyInput.value, 
            imageUrl: imageUrl, 
            date: serverTimestamp() 
        });

        alert("Новость опубликована!");
        titleInput.value = ''; bodyInput.value = ''; imageInput.value = '';
        statusText.innerText = '';
    } catch (e) { 
        alert("Ошибка: " + e.message); 
        statusText.innerText = '';
    }
});

// --- ПРИЕМНАЯ ---
async function loadReceptionMessages() {
    const container = document.getElementById('reception-container');
    container.innerHTML = '<p class="text-slate-400 italic font-medium px-2">Загрузка обращений...</p>';
    try {
        const q = query(collection(db, "reception"), orderBy("date", "desc"));
        const snap = await getDocs(q);
        container.innerHTML = '';
        
        if (snap.empty) {
            container.innerHTML = '<p class="text-slate-400 italic font-medium px-2">Новых обращений нет.</p>';
            return;
        }

        snap.forEach(d => {
            const msg = d.data();
            let dateStr = "Недавно";
            if (msg.date && typeof msg.date.toDate === 'function') dateStr = msg.date.toDate().toLocaleString('ru-RU');

            const card = document.createElement('div');
            card.className = "border-card p-6 bg-white relative";
            card.innerHTML = `
                <div class="flex justify-between items-start mb-4">
                    <div>
                        <span class="inline-block bg-brand-50 text-brand-600 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded mb-2">Кому: ${msg.target}</span>
                        <h4 class="font-black text-slate-900">${msg.name} <span class="text-slate-400 font-medium text-xs ml-2">(${msg.role})</span></h4>
                        <p class="text-xs text-slate-400 mt-1">${dateStr}</p>
                    </div>
                    <button data-id="${d.id}" class="delete-msg-btn text-red-400 hover:text-red-600 transition p-2 bg-red-50 hover:bg-red-100 rounded-lg">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                </div>
                <div class="text-sm text-slate-700 bg-slate-50 p-4 rounded-xl whitespace-pre-wrap">${msg.message}</div>
            `;
            container.appendChild(card);
        });

        document.querySelectorAll('.delete-msg-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (confirm("Точно удалить?")) {
                    await deleteDoc(doc(db, "reception", e.currentTarget.getAttribute('data-id')));
                    loadReceptionMessages(); 
                }
            });
        });
    } catch (error) {
        container.innerHTML = '<p class="text-red-500 font-bold px-2">Ошибка при загрузке.</p>';
    }
}

// --- УПРАВЛЕНИЕ УРОКАМИ ---
async function loadScheduleSettings() {
    try {
        const docSnap = await getDoc(doc(db, "settings", "schedule"));
        if (docSnap.exists()) {
            const data = docSnap.data();
            const today = new Date().toDateString();
            // Показываем в админке реальное значение, только если дата актуальная
            if (data.lessonDuration !== 45 && data.dateSet !== today) {
                document.getElementById('lesson-duration-select').value = "45";
            } else {
                document.getElementById('lesson-duration-select').value = data.lessonDuration || "45";
            }
        }
    } catch (e) {
        console.error("Ошибка загрузки настроек", e);
    }
}

document.getElementById('save-schedule-btn').addEventListener('click', async () => {
    const val = parseInt(document.getElementById('lesson-duration-select').value);
    const status = document.getElementById('schedule-status');
    try {
        status.innerText = "Сохранение...";
        // Записываем длительность и текущую дату для автосброса
        await setDoc(doc(db, "settings", "schedule"), {
            lessonDuration: val,
            dateSet: new Date().toDateString()
        });
        status.innerText = "Успешно сохранено!";
        setTimeout(() => status.innerText = "", 3000);
    } catch (e) {
        status.innerText = "Ошибка: " + e.message;
    }
});
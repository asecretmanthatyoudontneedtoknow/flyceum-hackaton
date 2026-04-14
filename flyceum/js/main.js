import { db } from './firebase-cfg.js';
import { collection, getDocs, query } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const DAYS = ['Понедельник','Вторник','Среда','Четверг','Пятница', 'Суббота'];
const BELL_PRESETS = { 45: { label: '45 мин', breaks:[5,15,10,15,10,5,5] } };
const slogans = ["Архитектура будущего.", "Хочешь быть первым — учись в Первом!", "Традиции прошлого — технологии будущего.", "Твой шаг к успешной карьере."];

let state = { activePreset: 45, firstLessonStart: '08:05', schedule: {} };
let newsData = [];

// --- ЛОКАЛЬНАЯ ЗАГРУЗКА РАСПИСАНИЯ ---
async function loadSchedule() {
    try {
        const response = await fetch('schedule.json');
        if (!response.ok) throw new Error("Файл не найден");
        
        const rawData = await response.json();
        let classesData = {};

        rawData.forEach(item => {
            const day = item.day;
            const num = parseInt(item.lesson_num);
            
            for (const [cls, info] of Object.entries(item.classes)) {
                const cleanCls = cls.trim();
                if (!classesData[cleanCls]) classesData[cleanCls] = {};
                if (!classesData[cleanCls][day]) classesData[cleanCls][day] = [];
                
                let roomStr = info.room === "---" || info.room === "" ? "—" : info.room;
                classesData[cleanCls][day].push({ lesson: num, subject: info.subject, room: roomStr });
            }
        });

        state.schedule = classesData;
        updateClassWidget();
    } catch (e) {
        console.error("Ошибка загрузки локального расписания:", e);
        document.getElementById('currentStatus').innerHTML = '<div class="py-10 text-center text-red-500 font-bold">Файл schedule.json не найден!</div>';
        document.getElementById('daySchedule').innerHTML = '';
    }
}

function generateBells(preset, startTime) {
    const duration = parseInt(preset);
    const breaks = BELL_PRESETS[preset].breaks;
    const [sh, sm] = startTime.split(':').map(Number);
    let cur = sh * 60 + sm;
    const bells = [];
    for (let i = 0; i < 8; i++) {
        bells.push({ 
            num: i + 1, 
            start: Math.floor(cur/60).toString().padStart(2,'0')+':'+(cur%60).toString().padStart(2,'0'), 
            end: Math.floor((cur+duration)/60).toString().padStart(2,'0')+':'+((cur+duration)%60).toString().padStart(2,'0'), 
            breakAfter: breaks[i] || 0 
        });
        cur += duration + (breaks[i] || 0);
    }
    return bells;
}

function getCurrentLesson() {
    const now = new Date();
    const curMins = now.getHours() * 60 + now.getMinutes();
    const bells = generateBells(state.activePreset, state.firstLessonStart);
    for (let b of bells) {
        const [sh, sm] = b.start.split(':').map(Number);
        const start = sh * 60 + sm;
        const end = start + 45;
        if (curMins >= start && curMins < end) return { type: 'lesson', num: b.num, remaining: end - curMins };
        if (curMins >= end && curMins < end + b.breakAfter) return { type: 'break', remaining: end + b.breakAfter - curMins };
    }
    return { type: 'free' };
}

function updateClassWidget() {
    const cls = document.getElementById('classSelect').value;
    let dayIndex = new Date().getDay() - 1;
    if (dayIndex < 0) dayIndex = 0; 
    const dayName = DAYS[dayIndex];
    
    const container = document.getElementById('currentStatus');

    if (!state.schedule[cls]) {
        container.innerHTML = '<div class="py-10 text-center text-slate-400 font-bold">Нет данных для этого класса</div>';
        document.getElementById('daySchedule').innerHTML = '';
        return;
    }

    const sched = state.schedule[cls];
    const status = getCurrentLesson();

    if (!status || status.type === 'free') {
        container.innerHTML = `<div class="py-10 text-center"><h3 class="text-xl text-slate-400 font-black italic">Уроки завершены / Отдых</h3></div>`;
    } else if (status.type === 'lesson') {
        const lessons = (sched[dayName] || []).filter(l => l.lesson === status.num);
        let subjText = lessons.length > 0 ? lessons.map(l => l.subject).join(' / ') : 'Нет урока';
        let roomText = lessons.length > 0 ? lessons.map(l => l.room).join(' / ') : '—';

        container.innerHTML = `<div class="flex justify-between mb-6"><div><p class="text-[10px] font-black text-brand-500 uppercase">Сейчас идет</p><h3 class="text-xl font-black italic truncate max-w-[200px]">${subjText}</h3></div><div class="bg-brand-50 p-2 rounded-xl text-brand-700 font-black text-[10px] h-max border border-brand-100">Каб. ${roomText}</div></div><div class="py-6 text-center border-y border-slate-100"><div class="text-7xl font-black">${status.remaining}m</div><p class="text-[10px] font-black text-slate-300 uppercase mt-2">Осталось</p></div>`;
    } else {
        container.innerHTML = `<div class="py-10 text-center"><h3 class="text-xl font-black uppercase tracking-widest text-brand-600 underline">Перемена</h3><div class="text-5xl font-black mt-2">${status.remaining}m</div></div>`;
    }
    
    renderDaySchedule(cls, dayName);
}

function renderDaySchedule(cls, day) {
    const container = document.getElementById('daySchedule');
    const lessons = (state.schedule[cls] || {})[day] || [];
    if (container) {
        container.innerHTML = lessons.map(l => `<div class="flex items-center justify-between p-3 rounded-2xl border border-slate-100 bg-white text-[11px] font-black uppercase mb-2"><div class="flex gap-3"><span class="text-slate-300 font-black w-4">${l.lesson}</span><span>${l.subject}</span></div><span class="text-brand-500 uppercase">${l.room}</span></div>`).join('');
    }
}

// --- НОВОСТИ (ЧЕРЕЗ FIREBASE) ---
async function loadNews() {
    const container = document.getElementById('news-container');
    if (!container) return;

    try {
        const q = query(collection(db, "news"));
        const snap = await getDocs(q);
        newsData = [];

        snap.forEach(d => {
            const n = d.data();
            n.id = d.id;
            newsData.push(n);
        });

        newsData.sort((a, b) => {
            const timeA = a.date ? (typeof a.date.toDate === 'function' ? a.date.toDate().getTime() : new Date(a.date).getTime()) : 0;
            const timeB = b.date ? (typeof b.date.toDate === 'function' ? b.date.toDate().getTime() : new Date(b.date).getTime()) : 0;
            return timeB - timeA;
        });

        const latestNews = newsData.slice(0, 6);
        container.innerHTML = '';

        if(latestNews.length === 0) {
            container.innerHTML = '<p class="text-slate-400 italic col-span-3">Лента новостей пока пуста.</p>';
            return;
        }

        latestNews.forEach(n => {
            let dateObj = new Date();
            if (n.date && typeof n.date.toDate === 'function') dateObj = n.date.toDate();
            else if (n.date && typeof n.date === 'string') dateObj = new Date(n.date);

            const dateStr = dateObj.toLocaleDateString('ru-RU', {day: 'numeric', month: 'long', year: 'numeric'});
            const imgUrl = n.imageUrl || 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=800&q=80';

            container.innerHTML += `
                <div class="border-card p-6 cursor-pointer flex flex-col hover:border-brand-500 transition" onclick="window.openNews('${n.id}')">
                    <div class="news-image-container mb-4 overflow-hidden rounded-xl aspect-video relative">
                        <img src="${imgUrl}" class="object-cover w-full h-full hover:scale-105 transition duration-500">
                    </div>
                    <p class="text-[10px] font-black text-brand-600 uppercase tracking-widest mb-2">${dateStr}</p>
                    <h4 class="text-xl font-black mb-3 italic leading-tight">${n.title}</h4>
                    <p class="text-slate-500 text-sm mt-auto truncate">${n.body}</p>
                </div>`;
        });

    } catch (e) { 
        console.error("News error", e); 
        container.innerHTML = `<div class="col-span-3 text-red-500 font-bold p-4 bg-red-50 rounded-xl">Ошибка базы данных: ${e.message}</div>`;
    }
}

// --- УПРАВЛЕНИЕ ОКНОМ ---
window.openNews = function(id) {
    const news = newsData.find(n => n.id === id);
    if (!news) return;

    let dateObj = new Date();
    if (news.date && typeof news.date.toDate === 'function') dateObj = news.date.toDate();
    else if (news.date && typeof news.date === 'string') dateObj = new Date(news.date);

    const imgUrl = news.imageUrl || 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=800&q=80';
    document.getElementById('modal-img').src = imgUrl;
    
    document.getElementById('modal-date').innerText = dateObj.toLocaleDateString('ru-RU', {day: 'numeric', month: 'long', year: 'numeric'});
    document.getElementById('modal-title').innerText = news.title;
    document.getElementById('modal-body').innerHTML = `<p>${news.body.replace(/\n/g, '<br><br>')}</p>`;
    
    document.getElementById('news-modal').classList.add('active');
    document.body.style.overflow = 'hidden';
};

window.closeNews = function() {
    document.getElementById('news-modal').classList.remove('active');
    document.body.style.overflow = 'auto';
    setTimeout(() => { document.getElementById('modal-img').src = ''; }, 300);
};

// --- ГЛАВНАЯ ФУНКЦИЯ НАВИГАЦИИ ---
window.showPage = function(id) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Переключаем контентные секции
    document.querySelectorAll('.page-section').forEach(p => p.classList.remove('active-page'));
    const target = document.getElementById('page-' + id);
    if (target) target.classList.add('active-page');
    
    // Сбрасываем активности всех кнопок навигации
    document.querySelectorAll('.top-nav-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.mobile-nav-btn').forEach(btn => btn.classList.remove('active'));

    // Включаем активность для нужных кнопок (ПК + Мобилка)
    document.querySelectorAll(`.top-nav-btn[onclick*="'${id}'"]`).forEach(btn => btn.classList.add('active'));
    document.querySelectorAll(`.mobile-nav-btn[onclick*="'${id}'"]`).forEach(btn => btn.classList.add('active'));

    // Логика темной темы и дождя
    if (id === 'fund') {
        document.body.classList.add('dark-theme');
        if (typeof window.startRain === 'function') window.startRain();
    } else {
        document.body.classList.remove('dark-theme');
        if (typeof window.stopRain === 'function') window.stopRain();
    }
};

// --- ИНИЦИАЛИЗАЦИЯ (ОДИН РАЗ!) ---
document.addEventListener('DOMContentLoaded', () => {
    // Часы
    setInterval(() => { 
        const clock = document.getElementById('live-clock');
        if(clock) clock.innerText = new Date().toLocaleTimeString('ru-RU'); 
    }, 1000);
    
    // Слоган
    const title = document.getElementById('hero-title');
    if(title) title.innerText = slogans[Math.floor(Math.random() * slogans.length)];
    
    // Загрузки
    loadSchedule();
    loadNews();
    
    // События
    document.getElementById('classSelect').addEventListener('change', updateClassWidget);
});
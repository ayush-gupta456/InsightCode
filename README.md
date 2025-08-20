
# 🚀 InsightCode

🔗 **Live Demo:** [https://insightcode.vercel.app/](https://insightcode.vercel.app/)

## 📌 Overview
**InsightCode** is a full-stack web application that offers **AI-powered code review, debugging, and complexity analysis** using the **Google Gemini API**. It features a modern **React (Vite)** frontend and a robust **Node.js/Express** backend.

---

## ✨ Features
- ⚡ Fast and responsive **React frontend** built with Vite  
- ⚙️ Modular **Express backend** with clean route and service architecture  
- 🔐 Secure configuration using **environment variables**  
- ☁️ **Frontend deployed on Vercel**  
- 🔗 **Backend deployed on Render**  
- 🤖 Integrated with **Google Gemini API** for AI-driven insights  

---

## 🛠️ Tech Stack
| Layer      | Technology                  |
|------------|-----------------------------|
| Frontend   | React (Vite), Tailwind CSS  |
| Backend    | Node.js, Express            |
| AI API     | Google Gemini API           |
| Deployment | Vercel (frontend), Render (backend) |

---

## 🚀 Getting Started

### ✅ Prerequisites
- Node.js **v18+**
- npm (comes bundled with Node.js)

---

### ⚙️ Installation Steps

1. **Clone the repository**
   ```sh
   git clone https://github.com/ayush-gupta456/InsightCode.git
   cd InsightCode
   ```

2. **Install dependencies**

   **Frontend**
   ```sh
   cd frontend
   npm install
   ```

   **Backend**
   ```sh
   cd ../backend
   npm install
   ```

3. **Configure Environment Variables**

   Create `.env` files in both `frontend` and `backend` directories.

   **Frontend (`frontend/.env`)**
   ```
   VITE_API_URL=http://localhost:5000
   ```

   **Backend (`backend/.env`)**
   ```
   PORT=5000
   GOOGLE_GEMINI_KEY=your-google-gemini-api-key
   ```

4. **Run the application locally**

   **Start Backend**
   ```sh
   cd backend
   npm start
   ```

   **Start Frontend**
   ```sh
   cd ../frontend
   npm run dev
   ```

   Visit 👉 [http://localhost:5173](http://localhost:5173)

---

## 📁 Folder Structure

```plaintext
InsightCode/
├── backend/
│   ├── src/
│   │   ├── app.js
│   │   ├── routes/
│   │   │   └── ai.routes.js
│   │   └── services/
│   │       └── ai.service.js
│   ├── server.js
│   ├── package.json
│   ├── .env
│   └── .gitignore
├── frontend/
│   ├── public/
│   │   ├── code-review.jpg
│   │   └── vite.svg
│   ├── src/
│   │   ├── App.jsx
│   │   ├── Header.jsx
│   │   ├── Footer.jsx
│   │   ├── main.jsx
│   │   ├── assets/
│   │   │   └── react.svg
│   │   ├── App.css
│   │   ├── index.css
│   ├── index.html
│   ├── package.json
│   ├── .env
│   ├── README.md
│   ├── vite.config.js
│   └── eslint.config.js
├── README.md
```

---

## ☁️ Deployment Guide

### 🔹 Backend (Render)

1. Go to [Render](https://render.com) → Create a **New Web Service**
2. Connect your GitHub repository
3. Set the following configuration:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. Add environment variables in the Render dashboard:
   ```
   GOOGLE_GEMINI_KEY=your-google-gemini-api-key
   ```

After deployment, your backend will be accessible at a URL like:

```
https://insightcode-backend.onrender.com
```

---


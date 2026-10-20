/* After deploying the backend on Render, put its URL here (no trailing slash). */
window.FIN_API_URL = location.hostname==='localhost' ? 'https://financily-94e0.onrender.com' : 'https://financily-api.onrender.com';

/* Real OTP login through the backend (the site uses this automatically). */
window.FIN_AUTH = {
  async send(id, mode){
    const r = await fetch(window.FIN_API_URL+'/api/auth/send-otp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,mode})});
    const j = await r.json(); if(!j.ok) throw new Error(j.error||'send failed');
    if(j.devOtp) alert('Test mode OTP: '+j.devOtp); /* appears only when no SMS/email provider is set and NODE_ENV is not production */
  },
  async verify(id, mode, code){
    const r = await fetch(window.FIN_API_URL+'/api/auth/verify-otp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,code})});
    return (await r.json()).ok===true;
  }
};
/* Financily frontend config */
window.FIN_API_URL = 'https://financily-94e0.onrender.com';   // your Render backend

/* Real OTP service. index.html detects window.FIN_AUTH and stops using demo mode. */
(function () {
  async function post(path, body) {
    const r = await fetch(window.FIN_API_URL + path, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) { const e = new Error(j.error || 'Server error'); e.wrong = !!j.wrong; throw e; }
    return j;
  }
  window.FIN_AUTH = {
    send: (id, mode) => post('/api/otp/send', { id, mode }),
    verify: async (id, mode, code) => {
      try {
        const j = await post('/api/otp/verify', { id, mode, code });
        try { localStorage.setItem('finv', j.token); } catch (e) {}   // proof of verification, sent with the application
        return true;
      } catch (e) {
        if (e.wrong) return false;   // wrong code: let the page count attempts
        throw e;                     // expired / locked / network: page shows e.message
      }
    }
  };
})();

(function() {
  window.alert = function(message) {
    const isSuccess = /success|booked|added|completed|successfully/i.test(message);
    const isError = /fail|error|cannot|please|invalid/i.test(message);

    let icon = '<div style="font-size: 50px; color: #3498db; margin-bottom: 15px;">ℹ️</div>';
    let title = 'Notice';
    let btnColor = '#3498db';

    if (isSuccess) {
      icon = `
        <div style="width: 65px; height: 65px; border-radius: 50%; background: #27ae60; color: white; display: flex; align-items: center; justify-content: center; font-size: 32px; margin: 0 auto 20px auto; box-shadow: 0 4px 15px rgba(39, 174, 96, 0.3);">
          ✓
        </div>
      `;
      title = 'Success!';
      btnColor = '#27ae60';
    } else if (isError) {
      icon = `
        <div style="width: 65px; height: 65px; border-radius: 50%; background: #e74c3c; color: white; display: flex; align-items: center; justify-content: center; font-size: 32px; margin: 0 auto 20px auto; box-shadow: 0 4px 15px rgba(231, 76, 60, 0.3);">
          ✕
        </div>
      `;
      title = 'Error';
      btnColor = '#e74c3c';
    }

    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
      position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
      backgroundColor: 'rgba(0,0,0,0.5)', zIndex: '9999',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      opacity: '0', transition: 'opacity 0.3s ease', backdropFilter: 'blur(3px)'
    });

    const modal = document.createElement('div');
    Object.assign(modal.style, {
      backgroundColor: '#fff', borderRadius: '16px', padding: '30px',
      maxWidth: '350px', width: '90%', boxShadow: '0 15px 35px rgba(0,0,0,0.2)',
      fontFamily: '"Inter", "Segoe UI", sans-serif', textAlign: 'center',
      transform: 'scale(0.8)', transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
    });

    modal.innerHTML = `
      ${icon}
      <h3 style="margin: 0 0 10px 0; color: #2c3e50; font-size: 22px; font-weight: 600;">${title}</h3>
      <p style="margin: 0 0 25px 0; color: #666; font-size: 15px; line-height: 1.5; white-space: pre-line;">${message}</p>
      <button id="alert-ok" style="width: 100%; padding: 12px 0; border: none; border-radius: 8px; background: ${btnColor}; color: #fff; font-size: 16px; font-weight: 600; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 12px ${btnColor}40;">OK</button>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        overlay.style.opacity = '1';
        modal.style.transform = 'scale(1)';
      });
    });

    const close = () => {
      overlay.style.opacity = '0';
      modal.style.transform = 'scale(0.8)';
      setTimeout(() => {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }, 300);
    };

    modal.querySelector('#alert-ok').addEventListener('click', close);
    modal.querySelector('#alert-ok').onmouseover = function() { this.style.opacity = '0.85'; };
    modal.querySelector('#alert-ok').onmouseout = function() { this.style.opacity = '1'; };

    // Auto-close success messages slightly faster so user is not blocked
    if (isSuccess) {
      setTimeout(close, 2500);
    }
  };

  // Custom Confirm UI
  window.showConfirm = function(message) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      Object.assign(overlay.style, {
        position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
        backgroundColor: 'rgba(0,0,0,0.5)', zIndex: '10000',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: '0', transition: 'opacity 0.3s ease', backdropFilter: 'blur(2px)'
      });

      const modal = document.createElement('div');
      Object.assign(modal.style, {
        backgroundColor: '#fff', borderRadius: '12px', padding: '24px 32px',
        maxWidth: '400px', width: '90%', boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
        fontFamily: '"Inter", "Segoe UI", sans-serif', textAlign: 'center',
        transform: 'scale(0.9)', transition: 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
      });

      modal.innerHTML = `
        <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
        <h3 style="margin: 0 0 12px 0; color: #2c3e50; font-size: 20px; font-weight: 600;">Confirmation</h3>
        <p style="margin: 0 0 24px 0; color: #555; font-size: 15px; line-height: 1.5;">${message}</p>
        <div style="display: flex; gap: 12px; justify-content: center;">
          <button id="confirm-cancel" style="flex: 1; padding: 10px 0; border: none; border-radius: 8px; background: #f1f3f5; color: #495057; font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.2s;">Cancel</button>
          <button id="confirm-ok" style="flex: 1; padding: 10px 0; border: none; border-radius: 8px; background: #e74c3c; color: #fff; font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 12px rgba(231,76,60,0.2);">Yes, proceed</button>
        </div>
      `;

      overlay.appendChild(modal);
      document.body.appendChild(overlay);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          overlay.style.opacity = '1';
          modal.style.transform = 'scale(1)';
        });
      });

      const close = (result) => {
        overlay.style.opacity = '0';
        modal.style.transform = 'scale(0.9)';
        setTimeout(() => {
          if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
          resolve(result);
        }, 300);
      };

      modal.querySelector('#confirm-cancel').addEventListener('click', () => close(false));
      modal.querySelector('#confirm-ok').addEventListener('click', () => close(true));
      
      // Add hover effects via JS since it's inline
      modal.querySelector('#confirm-cancel').onmouseover = function() { this.style.background = '#e2e6ea'; };
      modal.querySelector('#confirm-cancel').onmouseout = function() { this.style.background = '#f1f3f5'; };
      modal.querySelector('#confirm-ok').onmouseover = function() { this.style.background = '#c0392b'; };
      modal.querySelector('#confirm-ok').onmouseout = function() { this.style.background = '#e74c3c'; };
    });
  };
})();

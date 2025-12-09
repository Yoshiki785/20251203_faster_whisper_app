(() => {
  const form = document.getElementById('transcribe-form');
  const fileInput = document.getElementById('audio');
  const modelInput = document.getElementById('model');
  const submitBtn = document.getElementById('submit-btn');
  const statusEl = document.getElementById('status');
  const errorEl = document.getElementById('error');
  const candidatesEl = document.getElementById('candidates');
  const evaluationEl = document.getElementById('evaluation');
  const finalJa = document.getElementById('final-ja');
  const finalEn = document.getElementById('final-en');
  const finalZh = document.getElementById('final-zh');

  const setStatus = (text) => {
    statusEl.textContent = text;
  };

  const setError = (msg) => {
    errorEl.textContent = msg || '';
  };

  const clearResults = () => {
    candidatesEl.innerHTML = 'No results yet.';
    candidatesEl.classList.add('empty');
    evaluationEl.innerHTML = 'No evaluation yet.';
    evaluationEl.classList.add('empty');
    finalJa.value = '';
    finalEn.value = '';
    finalZh.value = '';
  };

  const renderCandidates = (candidates = []) => {
    if (!Array.isArray(candidates) || candidates.length === 0) {
      candidatesEl.innerHTML = 'No results yet.';
      candidatesEl.classList.add('empty');
      return;
    }

    candidatesEl.classList.remove('empty');
    candidatesEl.innerHTML = candidates
      .map(({ lang, text }) => {
        const safeLang = lang || 'N/A';
        const safeText = text || 'N/A';
        return `
          <div class="candidate-card">
            <header>
              <span class="lang">${safeLang}</span>
            </header>
            <div class="text">${escapeHtml(safeText)}</div>
          </div>
        `;
      })
      .join('');
  };

  const renderEvaluation = (evaluation) => {
    const evals = evaluation?.evaluations;
    if (!Array.isArray(evals) || evals.length === 0) {
      evaluationEl.innerHTML = 'No evaluation yet.';
      evaluationEl.classList.add('empty');
      return;
    }

    evaluationEl.classList.remove('empty');
    const rows = evals
      .map(({ lang, quality }) => {
        const safeLang = lang || 'N/A';
        const safeQuality = quality || 'N/A';
        const qualityClass = safeQuality === 'good' ? 'eval-good' : safeQuality === 'bad' ? 'eval-bad' : '';
        return `<tr><td>${safeLang}</td><td class="${qualityClass}">${safeQuality}</td></tr>`;
      })
      .join('');

    evaluationEl.innerHTML = `
      <table class="eval-table">
        <thead>
          <tr><th>Lang</th><th>Quality</th></tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;
  };

  const renderFinalTexts = (finalObj = {}) => {
    finalJa.value = finalObj.ja || '';
    finalEn.value = finalObj.en || '';
    finalZh.value = finalObj.zh || '';
  };

  const escapeHtml = (unsafe) => {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    setError('');

    const file = fileInput.files?.[0];
    if (!file) {
      setError('Please select an audio file.');
      return;
    }

    clearResults();
    setStatus('Processing...');
    submitBtn.disabled = true;

    const formData = new FormData();
    formData.append('audio', file);
    if (modelInput.value.trim()) {
      formData.append('model', modelInput.value.trim());
    }

    try {
      const response = await fetch('/api/transcribe-and-merge', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Request failed');
      }

      const data = await response.json();
      renderCandidates(data?.candidates);
      renderEvaluation(data?.evaluation);
      renderFinalTexts(data?.evaluation?.final || {});
      setStatus('Done');
    } catch (err) {
      console.error(err);
      setError(err?.message || 'Something went wrong. Please try again.');
      setStatus('Error');
    } finally {
      submitBtn.disabled = false;
    }
  });
})();

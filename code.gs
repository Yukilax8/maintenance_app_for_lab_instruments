function doGet() {
  return HtmlService.createHtmlOutput(`
<!DOCTYPE html>
<html lang="ja">
  <head>
    <base target="_top">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>装置使用記録</title>
    <style>
      body {
        font-family: sans-serif;
        font-size: 22px;
        padding: 30px;
        max-width: 700px;
        margin: auto;
        background-color: #fafafa;
      }
      h2 {
        font-size: 28px;
        margin-bottom: 30px;
        text-align: center;
      }
      label {
        display: block;
        margin-top: 24px;
        font-weight: bold;
      }
      input[type="text"],
      input[type="number"],
      textarea {
        width: 100%;
        padding: 16px;
        font-size: 20px;
        margin-top: 8px;
        box-sizing: border-box;
        border-radius: 8px;
        border: 1px solid #ccc;
        background: #fff;
      }
      .checkbox-row {
        display: flex;
        gap: 18px;
        margin-top: 12px;
      }
      .checkbox-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 0;
      }
      .checkbox-item input[type="checkbox"] {
        transform: scale(1.6);
      }
      .subtext {
        margin-top: 6px;
        font-size: 14px;
        color: #666;
      }
      #nowView {
        margin-top: 8px;
        font-size: 18px;
        color: #333;
      }
      .error {
        display: none;
        margin-top: 16px;
        padding: 12px;
        border-radius: 8px;
        background: #d32f2f;
        color: #fff;
        font-size: 16px;
      }
      .btn {
        margin-top: 28px;
        padding: 18px;
        width: 100%;
        font-size: 22px;
        font-weight: 700;
        background-color: #4CAF50;
        color: white;
        border: none;
        border-radius: 10px;
        transition: transform 0.06s ease, box-shadow 0.06s ease, opacity 0.2s ease;
        box-shadow: 0 6px 12px rgba(0,0,0,0.12);
      }
      .btn:active,
      .btn.pressed {
        transform: translateY(1px) scale(0.99);
        box-shadow: 0 3px 8px rgba(0,0,0,0.16);
      }
      .btn[disabled] {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .btn-content-inline {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
      }
      .spinner {
        display: inline-block;
        width: 1em;
        height: 1em;
        border: 3px solid rgba(255,255,255,0.6);
        border-top-color: #fff;
        border-radius: 50%;
        animation: spin 0.7s linear infinite;
        vertical-align: middle;
      }
      @keyframes spin { to { transform: rotate(360deg); } }
    </style>
  </head>

  <body>
    <h2>超純水製造装置 日常点検フォーム</h2>

    <!-- 氏名 -->
    <label for="name">氏名（必須）</label>
    <input type="text" id="name" placeholder="小島研究室" autocomplete="name" inputmode="text">

    <!-- モード（立ち上げ／立下げ：相互排他） -->
    <label>モード（必須）</label>
    <div class="checkbox-row">
      <div class="checkbox-item">
        <input type="checkbox" id="startup">
        <label for="startup" style="font-weight:normal;">立ち上げ</label>
      </div>
      <div class="checkbox-item">
        <input type="checkbox" id="shutdown">
        <label for="shutdown" style="font-weight:normal;">立ち下げ</label>
      </div>
    </div>
    <div id="nowView" class="subtext">現在時刻（参考）：—</div>

    <!-- 比抵抗 -->
    <label for="resistivity">比抵抗 (MΩ·cm)（必須）</label>
    <input type="number" id="resistivity" step="0.01" min="0" max="18.2" inputmode="decimal" placeholder="例: 18.20">
    <div class="subtext">入力範囲：0 ～ 18.20</div>

    <!-- 備考 -->
    <label for="remark">備考（任意）</label>
    <textarea id="remark" rows="3" placeholder="気づき、操作メモなど"></textarea>

    <!-- エラー表示 -->
    <div id="error" class="error"></div>

    <!-- 送信ボタン（Enter送信なし：form未使用） -->
    <button id="submitBtn" class="btn" type="button">
      <span id="btnLabel" class="btn-content-inline">使用記録を送信</span>
      <span id="btnSpin" class="btn-content-inline" style="display:none;">
        <span class="spinner"></span> 送信中…
      </span>
    </button>

    <script>
      const $ = (id) => document.getElementById(id);

      function pad2(n){ return String(n).padStart(2,'0'); }
      function nowHm() {
        const d = new Date();
        return pad2(d.getHours()) + ":" + pad2(d.getMinutes());
      }
      function vibrate(ms=10) {
        if (navigator.vibrate) { try { navigator.vibrate(ms); } catch(e){} }
      }

      // 相互排他（チェックボックスだが挙動はラジオ相当）
      function setupMutualExclusive() {
        const startup = $("startup");
        const shutdown = $("shutdown");
        function updateNowView() {
          const anyChecked = startup.checked || shutdown.checked;
          $("nowView").textContent = "現在時刻（参考）：" + (anyChecked ? nowHm() : "—");
        }
        startup.addEventListener("change", () => {
          if (startup.checked) shutdown.checked = false;
          updateNowView();
        });
        shutdown.addEventListener("change", () => {
          if (shutdown.checked) startup.checked = false;
          updateNowView();
        });
        updateNowView();
      }

      // 送信ボタンUI制御
      function setSubmitting(on) {
        $("submitBtn").disabled = on;
        $("btnLabel").style.display = on ? "none" : "inline-flex";
        $("btnSpin").style.display = on ? "inline-flex" : "none";
      }

      function showError(msg) {
        const el = $("error");
        el.textContent = msg;
        el.style.display = "block";
      }
      function hideError() {
        const el = $("error");
        el.textContent = "";
        el.style.display = "none";
      }

      function validate() {
        const name = ($("name").value || "").trim();
        const startup = $("startup").checked;
        const shutdown = $("shutdown").checked;
        const mode = startup ? "startup" : (shutdown ? "shutdown" : "");
        const rhoStr = $("resistivity").value;
        const rho = Number(rhoStr);

        if (!name) return { ok:false, message:"氏名を入力してください" };
        if (!mode) return { ok:false, message:"モード（立ち上げ／立ち下げ）を選択してください" };
        if (!isFinite(rhoStr) && !isFinite(rho)) return { ok:false, message:"比抵抗に数値を入力してください" };
        if (!isFinite(rho)) return { ok:false, message:"比抵抗に数値を入力してください" };
        if (rho < 0 || rho > 18.2) return { ok:false, message:"比抵抗は 0～18.20 の範囲で入力してください" };

        return {
          ok:true,
          data: {
            name,
            mode,
            resistivity: rho,
            remark: $("remark").value || ""
            // 時刻はサーバ側で付与（SpreadsheetのTimestamp）
          }
        };
      }

      function setPressedVisual(on) {
        const btn = $("submitBtn");
        if (on) btn.classList.add("pressed");
        else btn.classList.remove("pressed");
      }

      // 送信ハンドラ
      function handleSubmit() {
        hideError();
        setPressedVisual(true);
        vibrate(10); // 可能なら軽くハプティクス

        const v = validate();
        if (!v.ok) {
          setPressedVisual(false);
          showError(v.message);
          return;
        }

        setSubmitting(true);
        google.script.run
          .withSuccessHandler(() => {
            alert("記録しました！");
            // 氏名は残す。比抵抗と備考だけリセット。
            $("resistivity").value = "";
            $("remark").value = "";
            setSubmitting(false);
            setPressedVisual(false);
          })
          .withFailureHandler((err) => {
            const msg = (err && err.message) ? err.message : String(err);
            showError("送信に失敗しました: " + msg);
            setSubmitting(false);
            setPressedVisual(false);
          })
          .submitData(v.data);
      }

      // 初期化
      window.addEventListener("load", () => {
        setupMutualExclusive();
        // 氏名のローカル保存（任意）
        const saved = localStorage.getItem("deviceLog:name");
        if (saved) $("name").value = saved;

        $("name").addEventListener("change", () => {
          const val = ($("name").value || "").trim();
          if (val) localStorage.setItem("deviceLog:name", val);
        });

        // ボタン：押した感（mousedown/ touchstart 即時反映）
        const btn = $("submitBtn");
        btn.addEventListener("mousedown", () => setPressedVisual(true));
        btn.addEventListener("mouseup", () => setPressedVisual(false));
        btn.addEventListener("mouseleave", () => setPressedVisual(false));
        btn.addEventListener("touchstart", () => setPressedVisual(true), {passive:true});
        btn.addEventListener("touchend", () => setPressedVisual(false), {passive:true});

        btn.addEventListener("click", handleSubmit);
      });
    </script>
  </body>
</html>
  `);
}

/**
 * スプレッドシートに1行追記（サーバ時刻で記録）
 * ヘッダ自動整備：Timestamp, Mode, Name, Resistivity(MΩ·cm), Remark
 */
function submitData(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheets()[0];

  const header = ["Timestamp","Mode","Name","Resistivity(MΩ·cm)","Remark"];
  const current = sh.getRange(1,1,1,header.length).getValues()[0];
  if (header.join("|") !== current.join("|")) {
    sh.getRange(1,1,1,header.length).setValues([header]);
  }

  const row = [
    new Date(),                // サーバ時刻
    data.mode === "startup" ? "startup" : "shutdown",
    (data.name || "").trim(),
    Number(data.resistivity),
    data.remark || ""
  ];
  sh.appendRow(row);
}

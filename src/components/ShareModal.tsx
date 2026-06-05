import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Editor } from "../store";
import { encodeDesign } from "../engine/share";

export default function ShareModal({ ed, onClose }: { ed: Editor; onClose: () => void }) {
  const [url, setUrl] = useState("");
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const encoded = encodeDesign(ed.buildSharePayload());
    const link = `${location.origin}${location.pathname}#/app?d=${encoded}`;
    setUrl(link);
    QRCode.toDataURL(link, { margin: 1, width: 320, color: { dark: "#0c0e13", light: "#ffffff" } })
      .then(setQr)
      .catch(() => setQr(""));
  }, [ed]);

  const copy = () => {
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="share-modal" onClick={(e) => e.stopPropagation()}>
        <h3>مشاركة التصميم</h3>
        <p className="share-hint">رابط يحوي التصميم كاملاً — بلا خادم. امسح الرمز أو انسخ الرابط.</p>
        {qr && <div className="share-qr"><img src={qr} alt="QR" /></div>}
        <div className="share-url">
          <input value={url} readOnly dir="ltr" onFocus={(e) => e.target.select()} />
          <button className="tbtn primary" onClick={copy}>{copied ? "✓ نُسخ" : "نسخ"}</button>
        </div>
        <div className="share-actions">
          <a className="tbtn" href={qr} download="hexlight-qr.png">تنزيل الرمز</a>
          <button className="tbtn" onClick={onClose}>إغلاق</button>
        </div>
      </div>
    </div>
  );
}

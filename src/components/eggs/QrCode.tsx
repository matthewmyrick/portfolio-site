import qrcode from 'qrcode-generator';

// ASCII(-ish) QR code: two module rows per text row via half-block characters,
// rendered dark-on-light inside a white card so phone cameras actually scan it
// (inverted QRs on dark backgrounds are unreliable).

export function QrCode({ data, label }: { data: string; label: string }) {
  const qr = qrcode(0, 'M');
  qr.addData(data);
  qr.make();
  const n = qr.getModuleCount();
  const quiet = 2; // quiet-zone modules on each side
  const size = n + quiet * 2;
  const dark = (r: number, c: number): boolean => {
    const rr = r - quiet;
    const cc = c - quiet;
    if (rr < 0 || cc < 0 || rr >= n || cc >= n) return false;
    return qr.isDark(rr, cc);
  };

  const rows: string[] = [];
  for (let r = 0; r < size; r += 2) {
    let line = '';
    for (let c = 0; c < size; c++) {
      const top = dark(r, c);
      const bottom = r + 1 < size ? dark(r + 1, c) : false;
      line += top && bottom ? '█' : top ? '▀' : bottom ? '▄' : ' ';
    }
    rows.push(line);
  }

  return (
    <div className="my-1">
      <div
        className="inline-block rounded px-2 py-1 leading-none font-bold whitespace-pre"
        style={{ backgroundColor: '#ffffff', color: '#000000', fontSize: '12px' }}
      >
        {rows.map((row, i) => (
          <div key={i}>{row}</div>
        ))}
      </div>
      <div className="t-dim mt-1">
        {label} → <span className="t-cyan">{data}</span> · point a phone camera at it
      </div>
    </div>
  );
}

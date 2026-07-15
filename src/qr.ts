import QRCode from "qrcode";

export function textToQrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    margin: 1,
    width: 500,
  });
}

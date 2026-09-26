# Вырезание фона у кадров молнии.
#
# Исходники — кадры видео: белая молния на лилово-сером небе с вертикальным
# градиентом (сверху светлее, снизу темнее), внизу — блики от удара о землю.
# Фон отделяется по яркости: для каждой строки берётся уровень неба
# (30-й перцентиль яркости — молния занимает малую долю строки), и альфа
# считается от превышения над ним. Цвет «вычищается» из фона, чтобы ореол
# остался голубым, а не лиловым. Нижняя полоса с бликами плавно гасится.
#
#   powershell -ExecutionPolicy Bypass -File scripts/key-lightning.ps1

$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)

Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class LightningKey
{
    static double Smooth(double e0, double e1, double v)
    {
        double t = Math.Max(0, Math.Min((v - e0) / (e1 - e0), 1));
        return t * t * (3 - 2 * t);
    }

    public static void Key(string src, string dst, double low, double high, double fadeFrom, double fadeTo)
    {
        using (var input = new Bitmap(src))
        using (var bmp = input.Clone(new Rectangle(0, 0, input.Width, input.Height), PixelFormat.Format32bppArgb))
        {
            int w = bmp.Width, h = bmp.Height;
            var rect = new Rectangle(0, 0, w, h);
            var data = bmp.LockBits(rect, ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
            int stride = data.Stride;
            var px = new byte[stride * h];
            Marshal.Copy(data.Scan0, px, 0, px.Length);

            var lum = new double[w];
            var sorted = new double[w];

            for (int y = 0; y < h; y++)
            {
                int row = y * stride;
                for (int x = 0; x < w; x++)
                {
                    int i = row + x * 4;
                    lum[x] = 0.2126 * px[i + 2] + 0.7152 * px[i + 1] + 0.0722 * px[i];
                }

                Array.Copy(lum, sorted, w);
                Array.Sort(sorted);
                double bg = sorted[(int)(w * 0.3)];

                // Цвет неба в строке — среднее по самым тёмным пикселям.
                double br = 0, bgc = 0, bb = 0; int n = 0;
                double limit = sorted[(int)(w * 0.4)];
                for (int x = 0; x < w; x++)
                {
                    if (lum[x] > limit) continue;
                    int i = row + x * 4;
                    bb += px[i]; bgc += px[i + 1]; br += px[i + 2]; n++;
                }
                if (n > 0) { br /= n; bgc /= n; bb /= n; }

                double rowFade = 1 - Smooth(fadeFrom, fadeTo, (double)y / h);

                for (int x = 0; x < w; x++)
                {
                    int i = row + x * 4;
                    double a = Smooth(low, high, lum[x] - bg) * rowFade;

                    if (a <= 0.004)
                    {
                        px[i] = 0; px[i + 1] = 0; px[i + 2] = 0; px[i + 3] = 0;
                        continue;
                    }

                    // C = a*F + (1-a)*B  =>  F = (C - (1-a)*B) / a
                    double r = (px[i + 2] - (1 - a) * br) / a;
                    double g = (px[i + 1] - (1 - a) * bgc) / a;
                    double b = (px[i] - (1 - a) * bb) / a;

                    px[i + 2] = (byte)Math.Max(0, Math.Min(255, r));
                    px[i + 1] = (byte)Math.Max(0, Math.Min(255, g));
                    px[i] = (byte)Math.Max(0, Math.Min(255, b));
                    px[i + 3] = (byte)Math.Round(a * 255);
                }
            }

            Marshal.Copy(px, 0, data.Scan0, px.Length);
            bmp.UnlockBits(data);
            bmp.Save(dst, ImageFormat.Png);
        }
    }
}
'@

$out = 'src/assets/img/lightning'
New-Item -ItemType Directory -Force $out | Out-Null

# Порядок — стадии одного удара: два разряда → ветвление → полный удар.
$frames = @(
  @{ src = 'src/assets/img/videoframe_604.png';  dst = "$out/lightning_1.png" },
  @{ src = 'src/assets/img/videoframe_1512.png'; dst = "$out/lightning_2.png" },
  @{ src = 'src/assets/img/videoframe_1596.png'; dst = "$out/lightning_3.png" },
  @{ src = 'src/assets/img/videoframe_1697.png'; dst = "$out/lightning_4.png" },
  # Одиночные разряды — для младших тиров экрана выигрыша.
  @{ src = 'src/assets/img/single_lightning1.png'; dst = "$out/lightning_single_1.png" },
  @{ src = 'src/assets/img/single_lightning2.png'; dst = "$out/lightning_single_2.png" }
)

foreach ($f in $frames) {
  # low/high — превышение яркости над небом, дающее прозрачность 0 → 1;
  # fadeFrom/fadeTo — доля высоты, где гасится полоса бликов у земли.
  [LightningKey]::Key((Resolve-Path $f.src).Path, (Join-Path (Get-Location) $f.dst), 14, 120, 0.84, 0.97)
  "ok: $($f.dst)"
}

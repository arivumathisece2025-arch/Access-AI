import { useEffect, useRef } from 'react';

/** Decorative code background. It freezes to a static frame for reduced-motion users. */
export default function CodeRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const glyphs = '01{}<>/=+*#;:$&%';
    const fontSize = 14;
    let drops: number[] = [];
    let columns = 0;
    let frameId = 0;
    let lastFrame = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      columns = Math.floor(canvas.width / fontSize);
      drops = Array.from({ length: columns }, () => Math.floor((Math.random() * -canvas.height) / fontSize));
      context.fillStyle = '#0b1023';
      context.fillRect(0, 0, canvas.width, canvas.height);
    };

    const staticFrame = () => {
      context.fillStyle = '#0b1023';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.font = `${fontSize}px ui-monospace, Consolas, monospace`;
      context.fillStyle = 'rgba(129, 140, 248, 0.22)';
      for (let index = 0; index < columns; index += 1) {
        context.fillText(glyphs[index % glyphs.length], index * fontSize, (index * 53) % canvas.height);
      }
    };

    const frame = (time: number) => {
      frameId = requestAnimationFrame(frame);
      if (time - lastFrame < 55) return;
      lastFrame = time;
      context.fillStyle = 'rgba(11, 16, 35, 0.16)';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.font = `${fontSize}px ui-monospace, Consolas, monospace`;
      for (let index = 0; index < columns; index += 1) {
        const y = drops[index] * fontSize;
        context.fillStyle = Math.random() > 0.975 ? 'rgba(251, 191, 36, 0.9)' : 'rgba(129, 140, 248, 0.5)';
        context.fillText(glyphs[(Math.random() * glyphs.length) | 0], index * fontSize, y);
        if (y > canvas.height && Math.random() > 0.975) drops[index] = 0;
        drops[index] += 1;
      }
    };

    const onVisibility = () => {
      if (reduced) return;
      cancelAnimationFrame(frameId);
      if (document.visibilityState === 'visible') frameId = requestAnimationFrame(frame);
    };

    resize();
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', onVisibility);
    if (reduced) staticFrame();
    else frameId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return <canvas ref={canvasRef} className="code-rain" aria-hidden="true" />;
}

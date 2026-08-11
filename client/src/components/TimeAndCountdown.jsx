import { useState, useEffect } from 'react';
import { Calendar, Clock } from 'lucide-react';

export const TimeAndCountdown = () => {
  // Target date: September 15, 2026 23:59:59
  const targetDate = new Date(2026, 8, 15, 23, 59, 59).getTime();

  const [timeLeft, setTimeLeft] = useState({
    days: 14,
    hours: 8,
    minutes: 42,
    seconds: 15,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const difference = targetDate - now;

      if (difference > 0) {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        setTimeLeft({ days, hours, minutes, seconds });
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [targetDate]);

  const padNumber = (num) => {
    return num < 10 ? `0${num}` : `${num}`;
  };

  const countdownUnits = [
    { value: padNumber(timeLeft.days), label: 'Ngày' },
    { value: padNumber(timeLeft.hours), label: 'Giờ' },
    { value: padNumber(timeLeft.minutes), label: 'Phút' },
    { value: padNumber(timeLeft.seconds), label: 'Giây' },
  ];

  return (
    <div className="py-2.5 sm:py-4 px-4">
      <div className="max-w-xl mx-auto space-y-2">
        {/* Section 3: Time Information - Exactly 16px, #334155, centered */}
        <div className="flex items-center justify-center gap-1.5 text-[16px] font-medium text-slate-100 text-center drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)] [&_strong]:text-white">
          <Calendar className="w-5 h-5 text-sky-300 shrink-0" />
          <span>Từ ngày <strong className="text-[#0F172A] font-bold">01/09/2026</strong> đến hết <strong className="text-[#0F172A] font-bold">15/09/2026</strong></span>
        </div>

        {/* Section 4: Countdown Block (4 boxes) */}
        <div>
          <div className="flex items-center justify-center gap-1.5 mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-100 drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]">
            <Clock className="w-4 h-4 text-sky-300" />
            <span>Thời gian còn lại để làm bài thi</span>
          </div>

          {/* Grid layout for 4 boxes */}
          <div className="grid grid-cols-4 min-[360px]:grid-cols-4 grid-cols-2 gap-2 max-w-md mx-auto">
            {countdownUnits.map((unit, index) => (
              <div key={index} className="flex flex-col rounded-[10px] overflow-hidden shadow-z176">
                {/* Number Part: Flat #008BC5 background, white text weight 700, 20-24px */}
                <div className="bg-[#008BC5] text-white font-bold text-center py-1.5 text-[22px] min-[360px]:text-[24px] tracking-wider leading-none">
                  {unit.value}
                </div>
                {/* Label Strip: Flat #334155 background, white text 14px */}
                <div className="bg-[#334155] text-white text-[14px] font-medium text-center py-1 leading-none">
                  {unit.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

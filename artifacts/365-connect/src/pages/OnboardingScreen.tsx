import { useState } from 'react';
import { useLocation } from 'wouter';
import { Zap, Sparkles, DollarSign } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function OnboardingScreen() {
  const [, navigate]     = useLocation();
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    { id: 0, icon: Zap,       title: 'Find work near you',      body: 'Browse hundreds of shifts in your city. Apply in one tap.' },
    { id: 1, icon: Sparkles,  title: 'AI matches the best fit', body: 'Our matching engine connects the right people to the right shifts.' },
    { id: 2, icon: DollarSign, title: 'Clock in, work, get paid', body: 'GPS clock-in, instant timesheets, and same-week payouts.' },
  ];

  const handleNext = () => {
    if (currentSlide < slides.length - 1) setCurrentSlide((p) => p + 1);
    else navigate('/profile-setup');
  };

  const handleSkip = () => navigate('/profile-setup');

  return (
    <div className="min-h-[100dvh] flex flex-col relative overflow-hidden bg-white">
      {/* Slides Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <AnimatePresence mode="wait">
          <motion.div key={currentSlide} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.25, ease: 'easeOut' }}
            className="flex flex-col items-center w-full">
            {slides.map((slide, index) => {
              if (index !== currentSlide) return null;
              const Icon = slide.icon;
              return (
                <div key={slide.id} className="flex flex-col items-center w-full">
                  <div className="w-20 h-20 rounded-full bg-[#FAFAFA] border border-[#DBDBDB] flex items-center justify-center mb-8">
                    <Icon size={38} className="text-black" />
                  </div>
                  <h2 className="text-black font-bold text-[28px] text-center leading-tight">
                    {slide.title}
                  </h2>
                  <p className="text-[#737373] text-[15px] text-center mt-3 max-w-[280px] mx-auto leading-relaxed">
                    {slide.body}
                  </p>
                </div>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom Section */}
      <div className="w-full pb-10 px-6 pt-4">
        {/* Dots */}
        <div className="flex items-center justify-center gap-2 mb-6 h-2">
          {slides.map((_, idx) => (
            <div key={idx} className={`h-2 rounded-full transition-all duration-300 ${
              currentSlide === idx ? 'w-6 bg-black' : 'w-2 bg-[#DBDBDB]'
            }`} />
          ))}
        </div>

        {/* Buttons */}
        <button onClick={handleNext}
          className="w-full bg-black text-white font-bold text-center py-[18px] rounded-[8px] active:scale-[0.98] transition-transform"
          data-testid="btn-onboarding-next">
          {currentSlide === slides.length - 1 ? 'Get Started' : 'Next'}
        </button>

        <button onClick={handleSkip}
          className="w-full text-center mt-4 text-[#737373] text-sm font-medium hover:text-black transition-colors py-2"
          data-testid="btn-onboarding-skip">
          Skip
        </button>
      </div>
    </div>
  );
}

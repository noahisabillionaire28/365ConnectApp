import { useState } from 'react';
import { useLocation } from 'wouter';
import { Zap, Sparkles, DollarSign } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function OnboardingScreen() {
  const [, navigate] = useLocation();
  const [currentSlide, setCurrentSlide] = useState(0);

  // Default to worker variant slides
  const slides = [
    {
      id: 0,
      icon: Zap,
      title: "Find work near you",
      body: "Browse hundreds of shifts in your city. Apply in one tap."
    },
    {
      id: 1,
      icon: Sparkles,
      title: "AI matches the best fit",
      body: "Our matching engine connects the right people to the right shifts."
    },
    {
      id: 2,
      icon: DollarSign,
      title: "Clock in, work, get paid",
      body: "GPS clock-in, instant timesheets, and same-week payouts."
    }
  ];

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(prev => prev + 1);
    } else {
      navigate('/profile-setup');
    }
  };

  const handleSkip = () => {
    navigate('/profile-setup');
  };

  return (
    <div className="min-h-[100dvh] flex flex-col relative overflow-hidden bg-black">
      {/* Slides Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="flex flex-col items-center w-full"
          >
            {slides.map((slide, index) => {
              if (index !== currentSlide) return null;
              const Icon = slide.icon;
              return (
                <div key={slide.id} className="flex flex-col items-center w-full">
                  <Icon size={64} className="text-primary mb-6" />
                  <h2 className="text-white font-bold text-[28px] text-center leading-tight">
                    {slide.title}
                  </h2>
                  <p className="text-muted-foreground text-[15px] text-center mt-3 max-w-[280px] mx-auto leading-relaxed">
                    {slide.body}
                  </p>
                </div>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom Section */}
      <div className="w-full pb-10 px-6 pt-4 bg-gradient-to-t from-black to-transparent">
        {/* Dots */}
        <div className="flex items-center justify-center gap-2 mb-6 h-2">
          {slides.map((_, idx) => (
            <div
              key={idx}
              className={`h-2 rounded-full transition-all duration-300 ${
                currentSlide === idx ? 'w-6 bg-primary' : 'w-2 bg-[#2A2A2A]'
              }`}
            />
          ))}
        </div>

        {/* Buttons */}
        <button
          onClick={handleNext}
          className="w-full bg-primary text-primary-foreground font-bold text-center py-[18px] rounded-[14px] active:scale-[0.98] transition-transform"
          data-testid="btn-onboarding-next"
        >
          {currentSlide === slides.length - 1 ? "Get Started" : "Next"}
        </button>

        <button
          onClick={handleSkip}
          className="w-full text-center mt-4 text-[#555555] text-sm font-medium hover:text-white transition-colors py-2"
          data-testid="btn-onboarding-skip"
        >
          Skip
        </button>
      </div>
    </div>
  );
}

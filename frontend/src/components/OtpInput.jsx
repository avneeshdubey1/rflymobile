import { useState, useRef, useEffect } from 'react';

export default function OtpInput({ length = 6, onComplete, disabled }) {
  const [otp, setOtp] = useState(new Array(length).fill(''));
  const inputRefs = useRef([]);

  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  const handleChange = (e, index) => {
    const value = e.target.value;
    if (/[^0-9]/.test(value)) return; // Only allow numbers

    const newOtp = [...otp];
    // Keep only the last typed character in case they type quickly
    newOtp[index] = value.substring(value.length - 1);
    setOtp(newOtp);

    // Focus next input if a number is entered
    if (value && index < length - 1) {
      inputRefs.current[index + 1].focus();
    }

    const otpValue = newOtp.join('');
    if (onComplete) onComplete(otpValue);
  };

  const handleKeyDown = (e, index) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const newOtp = [...otp];
      newOtp[index] = '';
      setOtp(newOtp);
      if (onComplete) onComplete(newOtp.join(''));

      if (index > 0) {
        inputRefs.current[index - 1].focus();
      }
    } else if (e.key === 'ArrowLeft') {
      if (index > 0) {
        inputRefs.current[index - 1].focus();
      }
    } else if (e.key === 'ArrowRight') {
      if (index < length - 1) {
        inputRefs.current[index + 1].focus();
      }
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text/plain').replace(/[^0-9]/g, '').slice(0, length);
    if (!pastedData) return;

    const newOtp = [...otp];
    let focusIndex = 0;
    
    for (let i = 0; i < pastedData.length; i++) {
      newOtp[i] = pastedData[i];
      focusIndex = i;
    }
    setOtp(newOtp);

    if (focusIndex < length - 1) {
      inputRefs.current[focusIndex + 1].focus();
    } else {
      inputRefs.current[length - 1].focus();
      if (onComplete) {
        onComplete(newOtp.join(''));
      }
    }
  };

  return (
    <div className="otp-container">
      {otp.map((value, index) => (
        <input
          key={index}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          ref={(el) => (inputRefs.current[index] = el)}
          value={value}
          onChange={(e) => handleChange(e, index)}
          onKeyDown={(e) => handleKeyDown(e, index)}
          onPaste={handlePaste}
          className="otp-input"
          disabled={disabled}
          maxLength={2}
        />
      ))}
    </div>
  );
}

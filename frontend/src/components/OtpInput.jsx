import { useRef, useEffect } from 'react';

export default function OtpInput({ length = 6, value = '', onChange, onComplete, disabled, label = 'One-time password' }) {
  const inputRefs = useRef([]);
  const otp = Array.from({ length }, (_, index) => String(value || '')[index] || '');

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
    const otpValue = newOtp.join('');
    onChange?.(otpValue);

    // Focus next input if a number is entered
    if (value && index < length - 1) {
      inputRefs.current[index + 1].focus();
    }

    if (otpValue.length === length && onComplete) {
      onComplete(otpValue);
    }
  };

  const handleKeyDown = (e, index) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const newOtp = [...otp];
      newOtp[index] = '';
      onChange?.(newOtp.join(''));

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
    const otpValue = newOtp.join('');
    onChange?.(otpValue);

    if (focusIndex < length - 1) {
      inputRefs.current[focusIndex + 1].focus();
    } else {
      inputRefs.current[length - 1].focus();
      if (onComplete) {
        onComplete(otpValue);
      }
    }
  };

  return (
    <div className="otp-container" role="group" aria-label={label}>
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
          aria-label={`${label}, digit ${index + 1} of ${length}`}
        />
      ))}
    </div>
  );
}

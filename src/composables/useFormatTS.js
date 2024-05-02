export default function useFormatTS() {
    const formatTS = (milliseconds, locale = 'it-IT', options = {}) => {
      const defaultOptions = {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone: 'Europe/Rome' // Puoi cambiare il fuso orario in base alle necessità
      };
  
      const mergedOptions = { ...defaultOptions, ...options };
  
      const date = new Date(milliseconds);
      const formatter = new Intl.DateTimeFormat(locale, mergedOptions);
  
      return formatter.format(date);
    };
  
    return { formatTS };
  }
// file: useFormatEuro.js
export default function useFormatEuro() {
    const formatEuro = (value) => {
      if (!value) return '€0,00';
      const formatter = new Intl.NumberFormat('it-IT', {
        style: 'currency',
        currency: 'EUR',
      });
      return formatter.format(value);
    };
  
    return { formatEuro };
  }
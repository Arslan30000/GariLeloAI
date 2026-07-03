import { ThemeProvider, HomePage } from './components';

export default function Page() {
  return (
    <ThemeProvider>
      <HomePage />
    </ThemeProvider>
  );
}

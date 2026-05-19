import { Button } from '@/components/ui/button';

function App() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-background text-foreground">
      <h1 className="text-3xl font-bold">⚽ Toto WC26</h1>
      <p className="text-muted-foreground">
        World Cup 2026 prediction PWA — scaffold ready. Next: Supabase schema.
      </p>
      <Button>Hello world</Button>
    </div>
  );
}

export default App;

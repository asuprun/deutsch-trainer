import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Главная</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Каркас приложения готов. Карты появятся после первой загрузки скриншота.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>К повторению сегодня</CardTitle>
            <CardDescription>Подключится в Sprint 3</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">—</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Всего карт</CardTitle>
            <CardDescription>Подключится в Sprint 4</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">—</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Streak</CardTitle>
            <CardDescription>Подключится в Sprint 5</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">—</CardContent>
        </Card>
      </div>
    </div>
  );
}

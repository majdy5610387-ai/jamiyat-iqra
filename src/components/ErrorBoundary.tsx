import { Component, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  message: string
}

// يمنع انهيار الصفحة كاملة (شاشة بيضاء) لو رمى مكوّن فرعي خطأ أثناء العرض
// (خصوصًا استعلامات Dexie عبر useLiveQuery التي تُعيد رمي أي خطأ ليلتقطه
// أقرب Error Boundary). يعرض رسالة محصورة بمكان الخطأ فقط، وتبقى بقية
// الصفحة تعمل بشكل طبيعي.
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, message: '' }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'حدث خطأ غير متوقع',
    }
  }

  componentDidCatch(error: unknown) {
    console.error('[ErrorBoundary]', error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <section className="section-card">
          <p className="form-error">تعذّر عرض هذا القسم: {this.state.message}</p>
        </section>
      )
    }
    return this.props.children
  }
}

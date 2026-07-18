// الشعار الحقيقي لجمعية اقرأ الخيرية (public/logo.jpg) له خلفية مربعة رمادية
// فاتحة حول الدائرة. الحل هنا بدون أي معالجة صورة: حاوية بيضاء + قص دائري
// بـCSS (border-radius + overflow: hidden) على الصورة نفسها — الحلقة السوداء
// بالشعار تصل تقريبًا لحافة الإطار، فالقص الدائري يُزيل زوايا الرمادي تمامًا
// دون الحاجة لمعالجة الصورة برمجيًا.
interface LogoProps {
  size?: number
}

export default function Logo({ size = 64 }: LogoProps) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 14px rgba(0, 0, 0, 0.2)',
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      <img
        src="/logo.jpg"
        alt="شعار جمعية اقرأ الخيرية"
        style={{
          width: '92%',
          height: '92%',
          borderRadius: '50%',
          objectFit: 'cover',
        }}
      />
    </div>
  )
}

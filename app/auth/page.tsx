'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Eye, EyeOff, RefreshCw, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react'

type Mode = 'login' | 'signup' | 'forgot' | 'otp-verify' | 'reset-password'
type Method = 'email' | 'phone'

const SLP_BLUE = '#1A5FA8'
const inp = `w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100 bg-white`

export default function AuthPage() {
  const router = useRouter()
  const [mode,      setMode]      = useState<Mode>('login')
  const [method,    setMethod]    = useState<Method>('email')
  const [email,     setEmail]     = useState('')
  const [phone,     setPhone]     = useState('')
  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [fullName,  setFullName]  = useState('')
  const [showPw,    setShowPw]    = useState(false)
  const [showCpw,   setShowCpw]   = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [toast,     setToast]     = useState<{msg:string;type:'ok'|'err'}|null>(null)
  const [otpDigits, setOtpDigits] = useState(['','','','','',''])
  const [otpTarget, setOtpTarget] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [newPw,     setNewPw]     = useState('')
  const [showNewPw, setShowNewPw] = useState(false)
  const otpRefs = useRef<(HTMLInputElement|null)[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval>|null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        if (data.session.user?.recovery_sent_at) { setMode('reset-password'); return }
        router.replace('/')
      }
    })
    if (window.location.hash.includes('type=recovery')) setMode('reset-password')
  }, [router])

  function showToast(msg: string, type: 'ok'|'err' = 'ok') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  function startCountdown(sec = 60) {
    setCountdown(sec)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setCountdown(c => { if (c <= 1) { clearInterval(timerRef.current!); return 0 } return c - 1 })
    }, 1000)
  }

  async function handleLogin() {
    const id = method === 'email' ? email.trim() : normalizePhone(phone)
    if (!id)       { showToast('Please enter your ' + method, 'err'); return }
    if (!password) { showToast('Please enter your password', 'err'); return }
    setLoading(true)
    try {
      const creds = method === 'email' ? { email: id, password } : { phone: id, password }
      const { error } = await supabase.auth.signInWithPassword(creds as any)
      if (error) throw error
      showToast('Welcome back!')
      setTimeout(() => router.replace('/'), 800)
    } catch (e: any) { showToast(friendlyError(e.message), 'err') }
    setLoading(false)
  }

  async function handleSignup() {
    if (!fullName.trim())        { showToast('Full name is required', 'err'); return }
    const emailVal = email.trim()
    if (!emailVal)               { showToast('Email is required', 'err'); return }
    if (!isValidEmail(emailVal)) { showToast('Enter a valid email address', 'err'); return }
    if (password.length < 8)    { showToast('Password must be at least 8 characters', 'err'); return }
    if (password !== confirm)   { showToast('Passwords do not match', 'err'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/request-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailVal, password, full_name: fullName.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Request failed')
      showToast('Request sent! You will receive an email once approved.')
      setTimeout(() => setMode('login'), 2000)
    } catch (e: any) { showToast(friendlyError(e.message), 'err') }
    setLoading(false)
  }

  async function handleSendOtp() {
    if (method === 'email') {
      const emailVal = email.trim()
      if (!emailVal || !isValidEmail(emailVal)) { showToast('Enter a valid email address', 'err'); return }
      setLoading(true)
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(emailVal, {
          redirectTo: `${window.location.origin}/auth?mode=reset-password`,
        })
        if (error) throw error
        setOtpTarget(emailVal)
        showToast('Reset link sent! Check your email.')
        startCountdown(60)
      } catch (e: any) { showToast(friendlyError(e.message), 'err') }
      setLoading(false)
    } else {
      const phoneVal = normalizePhone(phone)
      if (!phoneVal || !isValidPhone(phone)) { showToast('Enter a valid Pakistan number: 03xxxxxxxxx', 'err'); return }
      setLoading(true)
      try {
        const { error } = await supabase.auth.signInWithOtp({ phone: phoneVal })
        if (error) throw error
        setOtpTarget(phoneVal)
        setMode('otp-verify')
        setOtpDigits(['','','','','',''])
        startCountdown(60)
        showToast('OTP sent to ' + phone)
      } catch (e: any) { showToast(friendlyError(e.message), 'err') }
      setLoading(false)
    }
  }

  async function handleVerifyOtp() {
    const token = otpDigits.join('')
    if (token.length !== 6) { showToast('Enter the 6-digit OTP', 'err'); return }
    setLoading(true)
    try {
      const { error } = await supabase.auth.verifyOtp({ phone: otpTarget, token, type: 'sms' })
      if (error) throw error
      showToast('Phone verified!')
      setTimeout(() => router.replace('/'), 800)
    } catch (e: any) { showToast(friendlyError(e.message), 'err') }
    setLoading(false)
  }

  async function handleResetPassword() {
    if (!newPw || newPw.length < 8) { showToast('Password must be at least 8 characters', 'err'); return }
    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPw })
      if (error) throw error
      showToast('Password reset successfully!')
      setTimeout(() => { setNewPw(''); setMode('login') }, 1500)
    } catch (e: any) { showToast(friendlyError(e.message), 'err') }
    setLoading(false)
  }

  function handleOtpKey(i: number, val: string) {
    if (!/^\d*$/.test(val)) return
    const next = [...otpDigits]; next[i] = val.slice(-1); setOtpDigits(next)
    if (val && i < 5) otpRefs.current[i+1]?.focus()
    if (!val && i > 0) otpRefs.current[i-1]?.focus()
  }

  function handleOtpPaste(e: React.ClipboardEvent) {
    const text = e.clipboardData.getData('text').replace(/\D/g,'').slice(0,6)
    if (text.length === 6) { setOtpDigits(text.split('')); otpRefs.current[5]?.focus(); e.preventDefault() }
  }

  function normalizePhone(p: string) {
    const digits = p.replace(/\D/g,'')
    if (digits.startsWith('0') && digits.length === 11) return '+92' + digits.slice(1)
    if (digits.startsWith('92')) return '+' + digits
    return p
  }
  function isValidEmail(e: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) }
  function isValidPhone(p: string) { const d = p.replace(/\D/g,''); return d.length >= 10 && d.length <= 13 }
  function friendlyError(msg: string): string {
    if (!msg) return 'Something went wrong. Please try again.'
    if (msg.includes('Invalid login credentials')) return 'Incorrect email or password'
    if (msg.includes('Email not confirmed'))       return 'Please verify your email first'
    if (msg.includes('already registered'))        return 'This email is already registered'
    if (msg.includes('User already registered'))   return 'This email is already registered'
    if (msg.includes('Password should be'))        return 'Password must be at least 8 characters'
    if (msg.includes('Token has expired'))         return 'OTP expired — please request a new one'
    if (msg.includes('Invalid OTP'))               return 'Incorrect OTP code'
    if (msg.includes('rate limit'))                return 'Too many attempts — wait a minute'
    return msg
  }
  function reset(m: Mode) { setMode(m); setOtpDigits(['','','','','','']); setPassword(''); setConfirm('') }

  const isLogin  = mode === 'login'
  const isSignup = mode === 'signup'
  const isForgot = mode === 'forgot'
  const isOtp    = mode === 'otp-verify'
  const isReset  = mode === 'reset-password'

  return (
    <div style={{
      minHeight:'100vh',
      background:'linear-gradient(135deg,#EAF2FB 0%,#F5F4F0 60%,#E8F1FB 100%)',
      display:'flex', alignItems:'center', justifyContent:'center',
      padding:'16px', fontFamily:'-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif',
    }}>
      {toast && (
        <div className="fixed bottom-5 left-1/2 z-50 max-w-xs w-auto px-4 py-2.5 rounded-2xl text-sm font-medium shadow-xl flex items-center gap-2"
          style={{ transform:'translateX(-50%)', background:toast.type==='ok'?'#1C1B19':'#9B2B2B', color:'#fff', zIndex:9999 }}>
          {toast.type==='ok' ? <CheckCircle2 size={15}/> : <AlertCircle size={15}/>}
          {toast.msg}
        </div>
      )}

      <div style={{ background:'white', borderRadius:24, width:'100%', maxWidth:420, boxShadow:'0 8px 48px rgba(26,95,168,0.12)', overflow:'hidden' }}>

        {/* Header */}
        <div style={{ background:SLP_BLUE, padding:'24px 28px 20px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <img src="https://smartlivingpakistan.com/wp-content/uploads/2025/07/New-logo-Smart-Living-Pakistan-mobile-7.png.webp"
              alt="SLP" style={{ height:36, width:'auto', borderRadius:8, background:'rgba(255,255,255,0.15)', padding:4 }}/>
            <div>
              <div style={{ color:'#fff', fontWeight:700, fontSize:15, lineHeight:1.2 }}>Smart Living Pakistan</div>
              <div style={{ color:'rgba(255,255,255,0.72)', fontSize:12 }}>Inventory Management</div>
            </div>
          </div>
          <div style={{ marginTop:16, color:'#fff', fontWeight:700, fontSize:20 }}>
            {isLogin  && 'Sign in to your account'}
            {isSignup && 'Request account access'}
            {isForgot && 'Reset your password'}
            {isOtp    && 'Enter OTP code'}
            {isReset  && 'Set new password'}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding:'24px 28px 28px' }}>

          {/* LOGIN */}
          {isLogin && (
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div style={{ display:'flex', background:'#F5F4F0', borderRadius:12, padding:3 }}>
                {(['email','phone'] as Method[]).map(m => (
                  <button key={m} onClick={()=>setMethod(m)} style={{ flex:1, height:34, borderRadius:10, border:'none', cursor:'pointer', fontSize:13, fontWeight:600, transition:'all .2s', background:method===m?'white':'transparent', color:method===m?SLP_BLUE:'#9C9B97', boxShadow:method===m?'0 1px 4px rgba(0,0,0,.08)':'none' }}>
                    {m==='email'?'📧 Email':'📱 Phone'}
                  </button>
                ))}
              </div>
              {method==='email'
                ? <input type="email" placeholder="Email address" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleLogin()} className={inp} style={{borderColor:'#E4E2DC'}}/>
                : <input type="tel" placeholder="Phone: 03xxxxxxxxx" value={phone} onChange={e=>setPhone(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleLogin()} className={inp} style={{borderColor:'#E4E2DC'}}/>
              }
              <div style={{position:'relative'}}>
                <input type={showPw?'text':'password'} placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleLogin()} className={inp} style={{borderColor:'#E4E2DC',paddingRight:44}}/>
                <button onClick={()=>setShowPw(p=>!p)} style={{position:'absolute',right:14,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'#9C9B97'}}>{showPw?<EyeOff size={16}/>:<Eye size={16}/>}</button>
              </div>
              <button onClick={()=>reset('forgot')} style={{textAlign:'right',fontSize:12,color:SLP_BLUE,background:'none',border:'none',cursor:'pointer',padding:0}}>Forgot password?</button>
              <button onClick={handleLogin} disabled={loading} style={{width:'100%',height:46,borderRadius:14,border:'none',cursor:'pointer',background:loading?'#7FA8D0':SLP_BLUE,color:'white',fontWeight:700,fontSize:15,display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
                {loading&&<RefreshCw size={16} className="animate-spin"/>}
                {loading?'Signing in…':'Sign In'}
              </button>
              <div style={{textAlign:'center',fontSize:13,color:'#6B6A66'}}>
                Need access?{' '}
                <button onClick={()=>reset('signup')} style={{color:SLP_BLUE,fontWeight:600,background:'none',border:'none',cursor:'pointer',padding:0}}>Request account</button>
              </div>
            </div>
          )}

          {/* SIGNUP */}
          {isSignup && (
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div style={{background:'#E8F1FB',borderRadius:12,padding:'10px 14px',fontSize:13,color:'#0C447C',lineHeight:1.5}}>
                ℹ️ Your request will be reviewed. You will receive an email once your account is approved.
              </div>
              <input type="text" placeholder="Full name *" value={fullName} onChange={e=>setFullName(e.target.value)} className={inp} style={{borderColor:'#E4E2DC'}}/>
              <input type="email" placeholder="Email address *" value={email} onChange={e=>setEmail(e.target.value)} className={inp} style={{borderColor:'#E4E2DC'}}/>
              <div style={{position:'relative'}}>
                <input type={showPw?'text':'password'} placeholder="Password (min 8 chars) *" value={password} onChange={e=>setPassword(e.target.value)} className={inp} style={{borderColor:'#E4E2DC',paddingRight:44}}/>
                <button onClick={()=>setShowPw(p=>!p)} style={{position:'absolute',right:14,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'#9C9B97'}}>{showPw?<EyeOff size={16}/>:<Eye size={16}/>}</button>
              </div>
              <div style={{position:'relative'}}>
                <input type={showCpw?'text':'password'} placeholder="Confirm password *" value={confirm} onChange={e=>setConfirm(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleSignup()} className={inp} style={{borderColor:confirm&&confirm!==password?'#E05A5A':'#E4E2DC',paddingRight:44}}/>
                <button onClick={()=>setShowCpw(p=>!p)} style={{position:'absolute',right:14,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'#9C9B97'}}>{showCpw?<EyeOff size={16}/>:<Eye size={16}/>}</button>
              </div>
              {confirm && confirm!==password && (
                <div style={{fontSize:12,color:'#E05A5A',display:'flex',gap:4,alignItems:'center'}}><AlertCircle size={12}/> Passwords do not match</div>
              )}
              <button onClick={handleSignup} disabled={loading} style={{width:'100%',height:46,borderRadius:14,border:'none',cursor:'pointer',background:loading?'#7FA8D0':SLP_BLUE,color:'white',fontWeight:700,fontSize:15,display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
                {loading&&<RefreshCw size={16} className="animate-spin"/>}
                {loading?'Sending request…':'Send Access Request'}
              </button>
              <div style={{textAlign:'center',fontSize:13,color:'#6B6A66'}}>
                Already have an account?{' '}
                <button onClick={()=>reset('login')} style={{color:SLP_BLUE,fontWeight:600,background:'none',border:'none',cursor:'pointer',padding:0}}>Sign in</button>
              </div>
            </div>
          )}

          {/* FORGOT */}
          {isForgot && (
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <button onClick={()=>reset('login')} style={{display:'flex',alignItems:'center',gap:6,fontSize:13,color:'#6B6A66',background:'none',border:'none',cursor:'pointer',padding:0}}><ArrowLeft size={14}/> Back to sign in</button>
              <div style={{ display:'flex', background:'#F5F4F0', borderRadius:12, padding:3 }}>
                {(['email','phone'] as Method[]).map(m => (
                  <button key={m} onClick={()=>setMethod(m)} style={{flex:1,height:34,borderRadius:10,border:'none',cursor:'pointer',fontSize:13,fontWeight:600,background:method===m?'white':'transparent',color:method===m?SLP_BLUE:'#9C9B97',boxShadow:method===m?'0 1px 4px rgba(0,0,0,.08)':'none',transition:'all .2s'}}>
                    {m==='email'?'📧 Email':'📱 Phone OTP'}
                  </button>
                ))}
              </div>
              {method==='email'
                ? <input type="email" placeholder="Email address" value={email} onChange={e=>setEmail(e.target.value)} className={inp} style={{borderColor:'#E4E2DC'}}/>
                : <input type="tel" placeholder="Phone: 03xxxxxxxxx" value={phone} onChange={e=>setPhone(e.target.value)} className={inp} style={{borderColor:'#E4E2DC'}}/>
              }
              <button onClick={handleSendOtp} disabled={loading||countdown>0} style={{width:'100%',height:46,borderRadius:14,border:'none',cursor:'pointer',background:(loading||countdown>0)?'#7FA8D0':SLP_BLUE,color:'white',fontWeight:700,fontSize:15,display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
                {loading&&<RefreshCw size={16} className="animate-spin"/>}
                {countdown>0?`Resend in ${countdown}s`:loading?'Sending…':method==='email'?'Send Reset Link':'Send OTP'}
              </button>
            </div>
          )}

          {/* OTP */}
          {isOtp && (
            <div style={{ display:'flex', flexDirection:'column', gap:18, alignItems:'center' }}>
              <button onClick={()=>reset('forgot')} style={{alignSelf:'flex-start',display:'flex',alignItems:'center',gap:6,fontSize:13,color:'#6B6A66',background:'none',border:'none',cursor:'pointer',padding:0}}><ArrowLeft size={14}/> Back</button>
              <p style={{fontSize:14,color:'#6B6A66',textAlign:'center'}}>Enter the 6-digit OTP sent to<br/><strong style={{color:'#1C1B19'}}>{otpTarget}</strong></p>
              <div style={{display:'flex',gap:8}}>
                {otpDigits.map((d,i) => (
                  <input key={i} ref={el=>{otpRefs.current[i]=el}} type="text" inputMode="numeric" maxLength={1} value={d}
                    onChange={e=>handleOtpKey(i,e.target.value)} onPaste={i===0?handleOtpPaste:undefined}
                    onKeyDown={e=>{if(e.key==='Backspace'&&!d&&i>0)otpRefs.current[i-1]?.focus()}}
                    style={{width:46,height:54,textAlign:'center',fontSize:22,fontWeight:700,borderRadius:12,border:`2px solid ${d?SLP_BLUE:'#E4E2DC'}`,outline:'none',background:d?'#EAF2FB':'white',color:SLP_BLUE,transition:'all .15s'}}/>
                ))}
              </div>
              <button onClick={handleVerifyOtp} disabled={loading||otpDigits.join('').length!==6} style={{width:'100%',height:46,borderRadius:14,border:'none',cursor:'pointer',background:(loading||otpDigits.join('').length!==6)?'#7FA8D0':SLP_BLUE,color:'white',fontWeight:700,fontSize:15,display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
                {loading&&<RefreshCw size={16} className="animate-spin"/>}{loading?'Verifying…':'Verify OTP'}
              </button>
              <button onClick={handleSendOtp} disabled={loading||countdown>0} style={{fontSize:13,color:countdown>0?'#9C9B97':SLP_BLUE,background:'none',border:'none',cursor:countdown>0?'default':'pointer'}}>
                {countdown>0?`Resend in ${countdown}s`:'Resend OTP'}
              </button>
            </div>
          )}

          {/* RESET */}
          {isReset && (
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <p style={{fontSize:14,color:'#6B6A66',textAlign:'center',lineHeight:1.5}}>Enter your new password. Must be at least 8 characters.</p>
              <div style={{position:'relative'}}>
                <input type={showNewPw?'text':'password'} placeholder="New password (min 8 chars)" value={newPw} onChange={e=>setNewPw(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleResetPassword()} className={inp} style={{borderColor:'#E4E2DC',paddingRight:44}}/>
                <button onClick={()=>setShowNewPw(p=>!p)} style={{position:'absolute',right:14,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'#9C9B97'}}>{showNewPw?<EyeOff size={16}/>:<Eye size={16}/>}</button>
              </div>
              <button onClick={handleResetPassword} disabled={loading||!newPw||newPw.length<8} style={{width:'100%',height:46,borderRadius:14,border:'none',cursor:'pointer',background:(loading||!newPw||newPw.length<8)?'#7FA8D0':SLP_BLUE,color:'white',fontWeight:700,fontSize:15,display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
                {loading&&<RefreshCw size={16} className="animate-spin"/>}{loading?'Resetting…':'Reset Password'}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

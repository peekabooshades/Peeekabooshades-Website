// Peekaboo Shades homepage JS (ported from app.js / inline) — visual behavior only
(function(){
  // ---- Hero slider ----
  var currentSlide = 0, slideInterval;
  var slides = document.querySelectorAll('.slide');
  var totalSlides = slides.length;
  function showSlide(index){
    if(index >= totalSlides) currentSlide = 0;
    else if(index < 0) currentSlide = totalSlides - 1;
    else currentSlide = index;
    slides.forEach(function(slide,i){ slide.classList.remove('active'); if(i===currentSlide) slide.classList.add('active'); });
  }
  function startAutoSlide(){ slideInterval = setInterval(function(){ showSlide(currentSlide+1); }, 5000); }
  function resetAutoSlide(){ clearInterval(slideInterval); startAutoSlide(); }
  window.changeSlide = function(direction){ showSlide(currentSlide + direction); resetAutoSlide(); };
  if(totalSlides > 0) startAutoSlide();

  // ---- Signup flyer popup (shows once per session) ----
  window.closeSignupFlyer = function(){
    var o = document.getElementById('signupFlyerOverlay');
    if(o){ o.classList.remove('show'); document.body.style.overflow=''; sessionStorage.setItem('signupFlyerDismissed','true'); }
  };
  window.goToSignup = function(){ window.closeSignupFlyer(); window.location.href = '/signup.html'; };
  window.addEventListener('load', function(){
    if(sessionStorage.getItem('signupFlyerDismissed')==='true') return;
    var o = document.getElementById('signupFlyerOverlay');
    if(o){ o.classList.add('show'); document.body.style.overflow='hidden'; }
  });
})();

/* Shared bits for every page: footer year and scroll reveal. */
(function(){
  var yr = document.getElementById('yr');
  if (yr) yr.textContent = new Date().getFullYear();
  var els = document.querySelectorAll('.rv');
  if (!('IntersectionObserver' in window)) { els.forEach(function(el){ el.classList.add('in'); }); return; }
  var io = new IntersectionObserver(function(es){
    es.forEach(function(e){ if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, {threshold:.15});
  els.forEach(function(el){ io.observe(el); });
})();

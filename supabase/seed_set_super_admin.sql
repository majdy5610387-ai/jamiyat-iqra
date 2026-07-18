-- تعيين حساب المدير الحالي (majdy5610387@gmail.com) كمدير عام.

update managers
set is_super_admin = true
where email = 'majdy5610387@gmail.com';

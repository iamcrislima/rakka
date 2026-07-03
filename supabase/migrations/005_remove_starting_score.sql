-- Remove starting_score column — score always starts from 0
alter table tournaments drop column if exists starting_score;

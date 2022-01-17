# parseenv语法规则

除了支出dotenv的语法，parseenv新增了一些语法。   

## 👋 include
引入其他env文件，可以是本地也可以是远程。   
```env
# main.env

# 本地
include ./production.env

# 远程, 远程路径必须得是http或者https
include http://your.com/main.env
```

## 👋 map
类似于对象，最终解析为对象。   
```env
# person 和 name 部分必须为字母或下划线开头
person{name} = lilin
person{age} = 29
```

## 👋 list
类似于数组，最终也解析为数组。      
```env
persons[] = lilin
persion[] = zhangsan
persons[] = lisi
# ... more
```

## 👋 if、elseif 
条件语句，必须以endif结尾，运算符目前支持等于（=）、不等于（！=）。
示例：   
```env
_MODE_ = production

if [_MODE_] = production
    HOST = https://a.com
else if [_MODE_] = development
    HOST = https://b.com
else
    HOST = https://c.com
endif

```
1.在条件语句中使用变量。   

>`[variable]` 这样写表示使用前面声明的名为variable的变量，   
也支持使用map的字段如`[map{field}]`，   
但是不支持list，如`[list[]]`、`[list[1]]`会报错!   
   
2.在条件语句中使用环境变量插值。  
>`{variable}` 这样写表示使用环境变量插值参与运算。
   
3.条件语句中的运算符。   
>目前仅支持`=`、`!=` 前者表示等于、后者表示不等于。      
> 多条件运算请注意，如`if [name1] = [name2] = [name3]`, 等同于 
> `[name1] === [name2] && [name2] === [name3]`。   

4.条件语句中使用字面量。     
> 就是字符或数字，如`if 123`、`if adcb`。     

## 👋 env insert
环境变量插值，就是在使用它的地方替换为当前的环境变量。   
远程的env文件中的环境变量插值也是使用本地的环境变量替换。   
!注意，环境变量插值只能使用在：value部分、include的path部分、条件语句中。   
示例：   
```env
person{name} = {name}
person{pass} = {pass}
include http://{name}:{pass}@xxx.com/main.env
```